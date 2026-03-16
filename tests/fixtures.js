// Playwright fixtures for testing Chrome extensions.
// Uses launchPersistentContext to load the unpacked extension.
const { test: base, chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const EXTENSION_PATH = path.resolve(__dirname, "..");

/**
 * Custom fixture that launches Chromium with the extension loaded.
 * Provides `context` (BrowserContext) and `extensionId` to each test.
 */
const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = path.join(__dirname, "..", "test-user-data");
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        "--no-first-run",
        "--disable-gpu",
        // Stealth flags to avoid bot detection / CAPTCHA loops
        "--disable-blink-features=AutomationControlled",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
      viewport: { width: 1280, height: 720 },
    });

    // Remove navigator.webdriver flag
    for (const page of context.pages()) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      });
    }
    context.on("page", async (page) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      });
    });

    // Load saved cookies from copy-chrome-session.js if available
    const cookiesFile = path.join(__dirname, "..", "test-user-data", "cookies.json");
    if (fs.existsSync(cookiesFile)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiesFile, "utf-8"));
        await context.addCookies(cookies);
        console.log(`  Loaded ${cookies.length} cookies from saved session`);
      } catch (e) {
        console.warn("  Warning: Could not load cookies:", e.message);
      }
    }

    await use(context);
    await context.close();
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

module.exports = { test };
