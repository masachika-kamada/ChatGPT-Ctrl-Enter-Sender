const { test } = require("./fixtures");
const { expect } = require("@playwright/test");

async function getServiceWorker(context) {
  return context.serviceWorkers()[0] || context.waitForEvent("serviceworker");
}

async function getSiteSettings(serviceWorker) {
  return serviceWorker.evaluate(async () => {
    const { siteSettings = {} } = await chrome.storage.sync.get("siteSettings");
    return siteSettings;
  });
}

test("saving one options change preserves a newer setting from another context", async ({ context, extensionId }) => {
  const serviceWorker = await getServiceWorker(context);
  await serviceWorker.evaluate(() => chrome.storage.sync.clear());

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`);

  const chatGptCheckbox = optionsPage.locator('[id="chatgpt.com"]');
  const claudeCheckbox = optionsPage.locator('[id="claude.ai"]');
  await expect(chatGptCheckbox).toBeChecked();
  await expect(claudeCheckbox).toBeChecked();

  await serviceWorker.evaluate(() => chrome.storage.sync.set({
    siteSettings: {
      "chatgpt.com": false,
      "www.genspark.ai": false,
    },
  }));

  await claudeCheckbox.uncheck();
  await optionsPage.locator("#saveButton").click();

  await expect.poll(() => getSiteSettings(serviceWorker)).toMatchObject({
    "chatgpt.com": false,
    "claude.ai": false,
    "www.genspark.ai": false,
  });
});

test("concurrent partial updates preserve both site settings", async ({ context, extensionId }) => {
  const serviceWorker = await getServiceWorker(context);
  await serviceWorker.evaluate(() => chrome.storage.sync.clear());

  const extensionPage = await context.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId}/options/options.html`);

  const responses = await extensionPage.evaluate(() => Promise.all([
    chrome.runtime.sendMessage({
      type: "update-site-settings",
      updates: { "chatgpt.com": false },
    }),
    chrome.runtime.sendMessage({
      type: "update-site-settings",
      updates: { "claude.ai": false },
    }),
  ]));

  expect(responses).toEqual([{ ok: true }, { ok: true }]);
  await expect.poll(() => getSiteSettings(serviceWorker)).toMatchObject({
    "chatgpt.com": false,
    "claude.ai": false,
  });
});

test("site-setting updates reject unsupported hosts", async ({ context, extensionId }) => {
  const serviceWorker = await getServiceWorker(context);
  await serviceWorker.evaluate(() => chrome.storage.sync.clear());

  const extensionPage = await context.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId}/options/options.html`);
  const response = await extensionPage.evaluate(() => chrome.runtime.sendMessage({
    type: "update-site-settings",
    updates: { "example.com": true },
  }));

  expect(response).toEqual({ ok: false, error: "Invalid site setting update" });
  expect(await getSiteSettings(serviceWorker)).toEqual({});
});

test("popup updates the active site's setting", async ({ context, extensionId }) => {
  const serviceWorker = await getServiceWorker(context);
  await serviceWorker.evaluate(() => chrome.storage.sync.clear());
  await context.route("https://chatgpt.com/**", (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><title>ChatGPT fixture</title>",
  }));

  const sitePage = await context.newPage();
  await sitePage.goto("https://chatgpt.com/");

  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);

  const siteTabId = await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
    return tab.id;
  });
  await serviceWorker.evaluate((tabId) => chrome.tabs.update(tabId, { active: true }), siteTabId);
  await popupPage.reload();

  const toggle = popupPage.locator("#isEnabled");
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();

  await expect.poll(() => getSiteSettings(serviceWorker)).toMatchObject({
    "chatgpt.com": false,
  });
  await expect(popupPage.locator("#statusMessage")).toBeHidden();
});
