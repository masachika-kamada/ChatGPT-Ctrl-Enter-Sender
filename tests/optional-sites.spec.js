/**
 * Optional-sites infrastructure test.
 *
 * Verifies the background service worker boots the opt-in machinery:
 *   - declarativeContent rules cover every supported site's match pattern
 *     (this is what keeps the action icon clickable on ungranted sites)
 *   - no dynamic content scripts are registered while no optional host
 *     permission has been granted
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
  test("declarativeContent rules cover all supported match patterns", async ({ context }) => {
    const serviceWorker = await getServiceWorker(context);

    // Rules are registered asynchronously from onInstalled/onStartup
    await expect(async () => {
      const rules = await serviceWorker.evaluate(
        () => new Promise((resolve) => chrome.declarativeContent.onPageChanged.getRules(resolve))
      );
      // Granted and ungranted sites are separate rules so they can carry different icons
      expect(rules.length).toBeGreaterThan(0);

      // one condition per match pattern: static content_scripts + optional hosts
      const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf-8"));
      const patternCount =
        manifest.content_scripts[0].matches.length + manifest.optional_host_permissions.length;
      const conditionCount = rules.reduce((total, rule) => total + rule.conditions.length, 0);
      expect(conditionCount).toBe(patternCount);
    }).toPass({ timeout: 5000 });
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
