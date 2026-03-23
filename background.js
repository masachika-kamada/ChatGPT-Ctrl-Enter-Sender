import { SUPPORTED_SITES, extractHostname } from "./constants/site-configs.js";

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = tab.url;
  const hostname = extractHostname(url);

  if (!url || !SUPPORTED_SITES.includes(hostname)) {
    chrome.action.disable(tabId);
    return;
  }

  if (changeInfo.status === "complete") {
    chrome.storage.sync.get("siteSettings", (data) => {
      const siteSettings = data.siteSettings || {};
      const isEnabled = siteSettings[hostname] ?? true;

      chrome.action.setIcon({ tabId, path: isEnabled ? "icon/enabled.png" : "icon/disabled.png" });
      chrome.action.enable(tabId);
    });
  }
});
