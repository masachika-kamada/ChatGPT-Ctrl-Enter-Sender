import { SUPPORTED_SITES } from "../constants/supported-sites.js";

let isEnabled = false;
const toggleButton = document.querySelector("#isEnabled");

function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  const hostname = extractHostname(tab.url);

  chrome.storage.sync.get("siteSettings", (data) => {
    const siteSettings = data.siteSettings || {};
    isEnabled = siteSettings[hostname] ?? true;
    toggleButton.checked = isEnabled;
    updateIcon(isEnabled, tab.id, hostname);
  });
});

toggleButton.addEventListener("change", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const hostname = extractHostname(tab.url);
    isEnabled = toggleButton.checked;

    chrome.storage.sync.get("siteSettings", (data) => {
      const siteSettings = data.siteSettings || {};
      siteSettings[hostname] = isEnabled;
      chrome.storage.sync.set({ siteSettings }, () => {
        updateIcon(isEnabled, tab.id, hostname);
      });
    });
  });
});

function updateIcon(enabled, tabId, hostname) {
  if (SUPPORTED_SITES.includes(hostname)) {
    chrome.browserAction.setIcon({ tabId, path: enabled ? "../icon/enabled.png" : "../icon/disabled.png" });
    chrome.browserAction.enable(tabId);
  } else {
    chrome.browserAction.disable(tabId);
  }
}
