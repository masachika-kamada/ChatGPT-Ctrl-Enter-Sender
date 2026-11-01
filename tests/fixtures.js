// Chromium is used as a test host because Playwright can load unpacked
// extensions there. The test build adapts only the background manifest field;
// production continues to use Firefox's Manifest V3 background.scripts.
const { test: base, chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const os = require("os");

const REPO_ROOT = path.resolve(__dirname, "..");
const PACKAGED_DIRS = ["_locales", "constants", "content", "icon", "options", "popup", "shared"];
const PACKAGED_FILES = ["service-worker.js", "manifest.json"];

function createTestExtension() {
  const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), "ctrl-enter-extension-"));
  for (const dir of PACKAGED_DIRS) {
    fs.cpSync(path.join(REPO_ROOT, dir), path.join(extensionPath, dir), { recursive: true });
  }
  for (const file of PACKAGED_FILES) {
    fs.copyFileSync(path.join(REPO_ROOT, file), path.join(extensionPath, file));
  }

  const manifestPath = path.join(extensionPath, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.background = {
    service_worker: manifest.background.scripts[0],
    type: manifest.background.type,
  };
  delete manifest.browser_specific_settings;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return extensionPath;
}

/**
 * Custom fixture that launches Chromium with the test-adapted extension loaded.
 * Provides `context` (BrowserContext) and `extensionId` to each test.
 */
const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrl-enter-test-"));
    const extensionPath = createTestExtension();

    const context = await chromium.launchPersistentContext(userDataDir, {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-first-run",
        "--disable-gpu",
        // Stealth flags to avoid bot detection / CAPTCHA loops
        "--disable-blink-features=AutomationControlled",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
      viewport: { width: 1280, height: 720 },
    });

    try {
      await use(context);
    } finally {
      await context.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
      fs.rmSync(extensionPath, { recursive: true, force: true });
    }
  },

  extensionId: async ({ context }, use) => {
    // Wait for service worker to register
    let serviceWorker;
    if (context.serviceWorkers().length > 0) {
      serviceWorker = context.serviceWorkers()[0];
    } else {
      serviceWorker = await context.waitForEvent("serviceworker");
    }
    const extensionId = serviceWorker.url().split("/")[2];
    await use(extensionId);
  },
});

module.exports = { test, createTestExtension };
