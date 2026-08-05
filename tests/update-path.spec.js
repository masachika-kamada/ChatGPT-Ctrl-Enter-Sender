/**
 * Update-path regression test.
 *
 * Chrome keeps serving the previous service worker script when its URL is
 * unchanged, so an extension update can leave the worker running pre-update
 * code: sites added by the update get no action rule and no content script.
 * v2.4.0 shipped with that defect.
 *
 * The guarantee this test protects is the repair path in shared/site-sync.js:
 * extension pages always load current code, so opening the popup after an
 * update must bring the action rules back in sync with the current manifest.
 *
 * The "previous version" is the current tree with its newest opt-in site
 * removed, which reproduces the stale worker without depending on git tags.
 */
const { test, expect, chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const os = require("os");

const REPO_ROOT = path.resolve(__dirname, "..");
const PACKAGED = ["_locales", "constants", "content", "icon", "options", "popup", "shared"];
const SITE_ENTRY = /\{ hostname: "([^"]+)", matchPatterns: \[([^\]]+)\], optional: true \},?\r?\n?/g;

function copyCurrentBuild(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  for (const dir of PACKAGED) {
    fs.cpSync(path.join(REPO_ROOT, dir), path.join(targetDir, dir), { recursive: true });
  }
  fs.copyFileSync(path.join(REPO_ROOT, "service-worker.js"), path.join(targetDir, "service-worker.js"));
  fs.copyFileSync(path.join(REPO_ROOT, "manifest.json"), path.join(targetDir, "manifest.json"));
}

function buildPreviousVersion(targetDir) {
  copyCurrentBuild(targetDir);

  const configPath = path.join(targetDir, "constants", "site-configs.js");
  const configSource = fs.readFileSync(configPath, "utf-8");
  const entries = [...configSource.matchAll(SITE_ENTRY)];
  const newest = entries.at(-1);
  expect(newest, "site-configs.js has no opt-in site to remove").toBeTruthy();

  const patterns = newest[2].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
  fs.writeFileSync(configPath, configSource.replace(newest[0], ""));

  const manifestPath = path.join(targetDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  manifest.optional_host_permissions = manifest.optional_host_permissions.filter((p) => !patterns.includes(p));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return { removedHostname: newest[1] };
}

async function withExtension(userDataDir, extensionPath, fn) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--disable-gpu",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });
  try {
    const serviceWorker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
    return await fn(context, serviceWorker);
  } finally {
    await context.close();
  }
}

function readActionRuleRegexes(serviceWorker) {
  return serviceWorker.evaluate(async () => {
    const rules = await new Promise((resolve) => chrome.declarativeContent.onPageChanged.getRules(resolve));
    return rules.flatMap((rule) => rule.conditions.map((c) => c.pageUrl?.urlMatches));
  });
}

test("opening the popup after an update re-syncs the action rules", async () => {
  test.setTimeout(120000);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrl-enter-update-"));
  const extensionDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrl-enter-ext-"));

  try {
    const { removedHostname } = buildPreviousVersion(extensionDir);

    await withExtension(userDataDir, extensionDir, (context, serviceWorker) =>
      expect(async () => {
        expect((await readActionRuleRegexes(serviceWorker)).length).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 })
    );

    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "manifest.json"), "utf-8"));
    const expectedPatternCount =
      manifest.content_scripts[0].matches.length + manifest.optional_host_permissions.length;

    // Same profile, same extension id and same service worker URL: an update,
    // not a fresh install
    copyCurrentBuild(extensionDir);
    await withExtension(userDataDir, extensionDir, async (context, serviceWorker) => {
      const extensionId = serviceWorker.url().split("/")[2];
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

      await expect(async () => {
        const regexes = await readActionRuleRegexes(serviceWorker);
        expect(
          regexes.length,
          `Action rules were not re-synced after the update (${removedHostname} is missing)`
        ).toBe(expectedPatternCount);
      }).toPass({ timeout: 10000 });
    });
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.rmSync(extensionDir, { recursive: true, force: true });
  }
});
