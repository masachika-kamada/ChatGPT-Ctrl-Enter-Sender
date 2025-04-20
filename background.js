function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
}

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
      const isEnabled = siteSettings[hostname] ?? false;

      chrome.action.setIcon({ tabId, path: isEnabled ? "icon/enabled.png" : "icon/disabled.png" });
      chrome.action.enable(tabId);
    });
  }
});
