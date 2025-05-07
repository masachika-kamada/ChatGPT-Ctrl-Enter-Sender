const browserOrChrome = typeof browser !== "undefined" ? browser : chrome;

browserOrChrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = tab.url;
  browserOrChrome.storage.sync.get("isEnabled", (data) => {
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
                url.startsWith("https://dashboard.cohere.com/playground/chat") ||
                url.startsWith("https://copilot.microsoft.com"))) {
        if (changeInfo.status === "complete") {
          browserOrChrome.action.setIcon({ path: isEnabled ? "icon/enabled.png" : "icon/disabled.png" });
          browserOrChrome.action.enable(tabId);
        }
    } else {
      browserOrChrome.action.disable(tabId);
    }
  });
});
