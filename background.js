chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = tab.url;
  chrome.storage.sync.get("isEnabled", (data) => {
    const isEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
    if (url && (url.startsWith("https://chat.openai.com/chat") ||
                url.startsWith("https://poe.com") ||
                url.startsWith("https://www.phind.com"))) {
        if (changeInfo.status === "complete") {
          chrome.action.setIcon({ path: isEnabled ? "icon/enabled.png" : "icon/disabled.png" });
          chrome.action.enable(tabId);
        }
    } else {
      chrome.action.disable(tabId);
      chrome.action.setIcon({ path: "icon/na.png" });
    }
  });
});
