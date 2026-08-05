/**
 * Update-path regression test.
 *
 * An extension update can leave a service worker that was started before the
 * update running pre-update code, because its script URL is unchanged: sites
 * added by the update then get no action rule and no content script. v2.4.0
 * shipped with that defect.
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
const PACKAGED_DIRS = ["_locales", "constants", "content", "icon", "options", "popup", "shared"];
const PACKAGED_FILES = ["service-worker.js", "manifest.json"];
const SITE_ENTRY = /\{ hostname: "([^"]+)", matchPatterns: \[([^\]]+)\], optional: true \},?\r?\n?/g;
const ACTION_RULE_ID = "supported-sites";

function copyCurrentBuild(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  for (const dir of PACKAGED_DIRS) {
    fs.cpSync(path.join(REPO_ROOT, dir), path.join(targetDir, dir), { recursive: true });
  }
  for (const file of PACKAGED_FILES) {
    fs.copyFileSync(path.join(REPO_ROOT, file), path.join(targetDir, file));
  }
}

function buildPreviousVersion(targetDir) {
  copyCurrentBuild(targetDir);

  const configPath = path.join(targetDir, "constants", "site-configs.js");
  const configSource = fs.readFileSync(configPath, "utf-8");
  const newest = [...configSource.matchAll(SITE_ENTRY)].at(-1);
  expect(newest, "site-configs.js has no opt-in site to remove").toBeTruthy();

  const patterns = newest[2].split(",").map((pattern) => pattern.trim().replace(/^"|"$/g, ""));
  fs.writeFileSync(
    configPath,
    configSource.replace(newest[0], "").replace(/SITE_CONFIGS_REVISION = \d+/, "SITE_CONFIGS_REVISION = 0")
  );

  const manifestPath = path.join(targetDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  manifest.optional_host_permissions = manifest.optional_host_permissions.filter((p) => !patterns.includes(p));
  // A real update also bumps the version
  manifest.version = "0.0.1";
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
    return await fn(context);
  } finally {
    await context.close();
  }
}

// Reads from an extension page so the assertion does not depend on whether the
// service worker happens to be running
function readActionRules(page) {
  return page.evaluate(async () => {
    const rules = await new Promise((resolve) => chrome.declarativeContent.onPageChanged.getRules(resolve));
    return rules.map((rule) => ({
      id: rule.id,
      regexes: rule.conditions.map((condition) => condition.pageUrl?.urlMatches),
    }));
  });
}

test("opening the popup after an update re-syncs the action rules", async () => {
  test.setTimeout(120000);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrl-enter-update-"));
  const extensionDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrl-enter-ext-"));

  try {
    const { removedHostname } = buildPreviousVersion(extensionDir);

    const extensionId = await withExtension(userDataDir, extensionDir, async (context) => {
      const serviceWorker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
      const id = serviceWorker.url().split("/")[2];
      const page = await context.newPage();
      await page.goto(`chrome-extension://${id}/popup/popup.html`);

      await expect(async () => {
        const rules = await readActionRules(page);
        expect(rules.flatMap((rule) => rule.regexes).length).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      const regexes = (await readActionRules(page)).flatMap((rule) => rule.regexes);
      expect(
        regexes.some((regex) => regex.includes(removedHostname.replace(/\./g, "\\."))),
        `the previous version must not already know ${removedHostname}`
      ).toBe(false);

      return id;
    });

    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "manifest.json"), "utf-8"));
    const expectedPatternCount =
      manifest.content_scripts[0].matches.length + manifest.optional_host_permissions.length;

    // Same profile, same extension id and same service worker URL: an update,
    // not a fresh install
    copyCurrentBuild(extensionDir);
    await withExtension(userDataDir, extensionDir, async (context) => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

      await expect(async () => {
        const rules = await readActionRules(page);
        expect(rules.length, "the action rules must not be duplicated").toBe(1);
        expect(rules[0].id).toBe(ACTION_RULE_ID);
        expect(
          rules[0].regexes.some((regex) => regex.includes(removedHostname.replace(/\./g, "\\."))),
          `${removedHostname} was not re-synced after the update`
        ).toBe(true);
        expect(rules[0].regexes.length).toBe(expectedPatternCount);
      }).toPass({ timeout: 10000 });
    });
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.rmSync(extensionDir, { recursive: true, force: true });
  }
});
