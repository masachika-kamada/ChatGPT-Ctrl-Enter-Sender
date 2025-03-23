chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = tab.url;
  chrome.storage.sync.get("isEnabled", (data) => {
    const isEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
    if (url && (url.startsWith("https://chatgpt.com") ||
                url.startsWith("https://poe.com") ||
                url.startsWith("https://www.phind.com") ||
                url.startsWith("https://chat.mistral.ai") ||
                // url.startsWith("https://www.chatpdf.com") ||
                url.startsWith("https://www.perplexity.ai") ||
                url.startsWith("https://claude.ai") ||
                url.startsWith("https://notebooklm.google.com") ||
                url.startsWith("https://gemini.google.com") ||
                url.startsWith("https://you.com") ||
                url.startsWith("https://v0.dev") ||
                url.startsWith("https://chat.deepseek.com") ||
                url.startsWith("https://dashboard.cohere.com/playground/chat"))) {
        if (changeInfo.status === "complete") {
          chrome.action.setIcon({ path: isEnabled ? "icon/enabled.png" : "icon/disabled.png" });
          chrome.action.enable(tabId);
        }
    } else {
      chrome.action.disable(tabId);
    }
  });
});
