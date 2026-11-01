/**
 * Optional-sites infrastructure test.
 *
 * Verifies the Firefox manifest and optional-site registration behavior:
 *   - no Chromium-only declarativeContent API is required
 *   - no dynamic content scripts are registered without user permission
 */
const { test } = require("./fixtures");
const { expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

async function getServiceWorker(context) {
  if (context.serviceWorkers().length > 0) {
    return context.serviceWorkers()[0];
  }
  return context.waitForEvent("serviceworker");
}

test.describe("Optional Sites", () => {
  test("manifest uses Firefox background scripts without declarativeContent", async () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf-8"));
    expect(manifest.background).toEqual({ scripts: ["service-worker.js"], type: "module" });
    expect(manifest.permissions).not.toContain("declarativeContent");
    expect(manifest.browser_specific_settings.gecko.strict_min_version).toBeTruthy();
  });

  test("no dynamic content scripts while no optional permission is granted", async ({ context }) => {
    const serviceWorker = await getServiceWorker(context);

    const granted = await serviceWorker.evaluate(() =>
      chrome.permissions.contains({ origins: ["https://www.genspark.ai/*"] })
    );
    test.skip(granted, "profile already has the optional permission granted");

    const registered = await serviceWorker.evaluate(() =>
      chrome.scripting.getRegisteredContentScripts()
    );
    expect(registered).toEqual([]);
  });
});
