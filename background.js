chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = tab.url;
  chrome.storage.sync.get("isEnabled", (data) => {
    const isEnabled = data.isEnabled;
    if (url && (url.startsWith("https://chat.openai.com/chat") ||
                url.startsWith("https://poe.com") ||
                url.startsWith("https://www.phind.com"))) {
      chrome.action.setIcon({ path: isEnabled ? "icon/enabled.png" : "icon/disabled.png" });
      chrome.action.enable(tabId);
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["script.js"],
      });
    } else {
      chrome.action.disable(tabId);
      chrome.action.setIcon({ path: "icon/na.png" });
    }
  });
});
