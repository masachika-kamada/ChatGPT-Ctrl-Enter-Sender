let isEnabled = true;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ isEnabled: true });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request === "toggle") {
    isEnabled = !isEnabled;
    chrome.storage.sync.set({ isEnabled });
    sendResponse({ isEnabled });
  }
});

function checkURL(url) {
  const allowedUrls = [
    "https://chat.openai.com/chat",
    "https://poe.com",
    "https://www.phind.com"
  ];

  for (const allowedUrl of allowedUrls) {
    if (typeof url !== 'undefined' && url.startsWith(allowedUrl)) {
      return true;
    }
  }
  
  return false;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    const url = tab.url;
    console.log(`Tab ${tabId} updated, URL: ${url}`);
    if (!isEnabled || !checkURL(url)) {
      console.log(`Disabling action for tab ${tabId}`);
      chrome.action.setIcon({ path: "icon/na.png", tabId });
      chrome.action.disable(tabId);
      return;
    }
    console.log(`Enabling action for tab ${tabId}`);
    chrome.action.enable(tabId);
    chrome.storage.sync.get(["isEnabled"], (result) => {
      if (result.isEnabled) {
        console.log(`Setting enabled icon for tab ${tabId}`);
        chrome.action.setIcon({ path: "icon/enabled.png", tabId });
      } else {
        console.log(`Setting disabled icon for tab ${tabId}`);
        chrome.action.setIcon({ path: "icon/disabled.png", tabId });
      }
      console.log(`Icon set to ${result.isEnabled ? "enabled" : "disabled"} for tab ${tabId}`);
    });
  }
});

// 拡張機能を使用することが意図されていないサイトでは、「na.png」の拡張機能アイコンを設定