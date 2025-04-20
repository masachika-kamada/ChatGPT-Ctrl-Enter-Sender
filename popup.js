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
    isEnabled = siteSettings[hostname] ?? false;
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
  const SUPPORTED_SITES = [
    "chatgpt.com",
    "poe.com",
    "www.phind.com",
    "chat.mistral.ai",
    "www.perplexity.ai",
    "claude.ai",
    "you.com",
    "v0.dev",
    "dashboard.cohere.com",
    "notebooklm.google.com",
    "gemini.google.com",
    "chat.deepseek.com",
    "github.com",
    "grok.com",
    "copilot.microsoft.com"
  ];

  if (SUPPORTED_SITES.includes(hostname)) {
    chrome.action.setIcon({ tabId, path: enabled ? "icon/enabled.png" : "icon/disabled.png" });
    chrome.action.enable(tabId);
  } else {
    chrome.action.disable(tabId);
  }
}
