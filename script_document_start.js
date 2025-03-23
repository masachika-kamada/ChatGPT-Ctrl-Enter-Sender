function shouldHandleCtrlEnter(url, event) {
  if (url.startsWith("https://claude.ai")) {
    return event.target.tagName === "DIV" && event.target.contentEditable === "true";
  }
  if (url.startsWith("https://www.bing.com/chat")){
    return event.target.tagName === "CIB-SERP";
  }
  else if (url.startsWith("https://notebooklm.google.com")) {
    return event.target.tagName === "TEXTAREA" && event.target.classList.contains("query-box-input");
  }
  else if (url.startsWith("https://gemini.google.com")) {
    return event.target.tagName === "DIV" &&
           event.target.classList.contains("ql-editor") &&
           event.target.contentEditable === "true";
  }
  return false;
}

function findSendButton() {
  const submitButton = document.querySelector('query-box form button[type="submit"]');
  if (submitButton) return submitButton;
  return null;
}

function handleCtrlEnter(event) {
  const url = window.location.href;

  if (!shouldHandleCtrlEnter(url, event) || !event.isTrusted) {
    return;
  }

  const isOnlyEnter = event.code === "Enter" && !(event.ctrlKey || event.metaKey);
  const isCtrlEnter = event.code === "Enter" && event.ctrlKey;

  if (isOnlyEnter || isCtrlEnter) {
    // Prevent default behavior only for certain sites
    const preventDefaultSites = ["https://claude.ai", "https://www.phind.com"];
    if (preventDefaultSites.some((site) => url.startsWith(site))) {
      event.preventDefault();
    }
    event.stopImmediatePropagation();

    let eventConfig = {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      shiftKey: isOnlyEnter
    };

    const newEvent = new KeyboardEvent("keydown", eventConfig);
    event.target.dispatchEvent(newEvent);
  }

  // NotebookLM requires clicking the send button instead of dispatching Enter
  if (isCtrlEnter && url.startsWith("https://notebooklm.google.com")) {
    const sendButton = findSendButton();
    if (sendButton) {
      sendButton.click();
    }
  }
}

function enableSendingWithCtrlEnter() {
  document.addEventListener("keydown", handleCtrlEnter, { capture: true });
}

function disableSendingWithCtrlEnter() {
  document.removeEventListener("keydown", handleCtrlEnter, { capture: true });
}

// Load stored settings and enable/disable the feature accordingly
chrome.storage.sync.get("isEnabled", (data) => {
  const isEnabled = data.isEnabled ?? true;
  if (isEnabled) {
    enableSendingWithCtrlEnter();
  }
});

// Listen for changes in the settings and update the feature state
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.hasOwnProperty("isEnabled")) {
    const isEnabled = changes.isEnabled.newValue;
    if (isEnabled) {
      enableSendingWithCtrlEnter();
    } else {
      disableSendingWithCtrlEnter();
    }
  }
});
