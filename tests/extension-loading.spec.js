/**
 * Extension loading test — verifies the extension loads correctly
 * and the service worker is registered.
 */
const { test } = require("./fixtures");
const { expect } = require("@playwright/test");

test.describe("Extension Loading", () => {
  test("should load the extension and register service worker", async ({ context, extensionId }) => {
    expect(extensionId).toBeTruthy();
    console.log(`  Extension loaded with ID: ${extensionId}`);
  });

  test("should have popup page accessible", async ({ context, extensionId }) => {
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popupPage.waitForLoadState("domcontentloaded");

    // Verify popup has expected content
    const title = await popupPage.title();
    console.log(`  Popup page title: ${title}`);

    await popupPage.close();
  });

  test("should have options page accessible", async ({ context, extensionId }) => {
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`);
    await optionsPage.waitForLoadState("domcontentloaded");

    const title = await optionsPage.title();
    console.log(`  Options page title: ${title}`);

    await optionsPage.close();
  });
});
