/**
 * Opt-in site announcement test.
 *
 * Opt-in sites cannot be discovered from the page they are on, so the options
 * page is opened once for sites the user has neither granted nor been shown.
 * It must not open again afterwards.
 */
const { test } = require("./fixtures");
const { expect } = require("@playwright/test");

const OPTIONS_PATH = "options/options.html";

test.describe("Opt-in site announcement", () => {
  test("a first run opens the options page and records the sites", async ({ context, extensionId }) => {
    const optionsUrl = `chrome-extension://${extensionId}/${OPTIONS_PATH}`;

    await expect(async () => {
      expect(context.pages().map((page) => page.url())).toContain(optionsUrl);
    }).toPass({ timeout: 10000 });

    expect(context.pages().filter((page) => page.url() === optionsUrl)).toHaveLength(1);

    const serviceWorker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
    await expect(async () => {
      const stored = await serviceWorker.evaluate(() => chrome.storage.local.get("announcedOptionalSites"));
      expect(stored.announcedOptionalSites?.length).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });
  });
});
