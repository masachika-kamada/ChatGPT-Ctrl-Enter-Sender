import { SUPPORTED_SITES } from "./constants/supported-sites.js";

function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = tab.url;
  const hostname = extractHostname(url);

  if (!url || !SUPPORTED_SITES.includes(hostname)) {
    chrome.browserAction.disable(tabId);
    return;
  }

  if (changeInfo.status === "complete") {
    chrome.storage.sync.get("siteSettings", (data) => {
      const siteSettings = data.siteSettings || {};
      const isEnabled = siteSettings[hostname] ?? true;

      chrome.browserAction.setIcon({ tabId, path: isEnabled ? "icon/enabled.png" : "icon/disabled.png" });
      chrome.browserAction.enable(tabId);
    });
  }
});
