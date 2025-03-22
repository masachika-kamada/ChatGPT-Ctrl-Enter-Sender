let isHandleCtrlEnterEnabled = false;

function shouldHandleCtrlEnter(url, event) {
  if (url.startsWith("https://claude.ai")) {
    return event.target.tagName === "DIV" && event.target.contentEditable === "true";
  }
  if (url.startsWith("https://www.bing.com/chat")){
    return event.target.tagName === "CIB-SERP";
  }
  if (url.startsWith("https://notebooklm.google.com")) {
    return event.target.tagName === "TEXTAREA" && event.target.classList.contains("query-box-input");
  }  
  if (url.startsWith("https://gemini.google.com")) {
    return event.target.tagName === "DIV" && 
           event.target.classList.contains("ql-editor") && 
           event.target.contentEditable === "true";
  }
  return false;
}

function shouldPreventDefault(url){
  if (url.startsWith("https://claude.ai")) {
    return true;
  }
  if (url.startsWith("https://www.bing.com/chat")){
    return false;
  }
  if (url.startsWith("https://notebooklm.google.com")) {
    return false;
  }
  if (url.startsWith("https://gemini.google.com")) {
    return false;
  }
  throw new Error("Unexpected URL: " + url);
}

function findSendButton() {
  const submitButton = document.querySelector('query-box form button[type="submit"]');
  if (submitButton) return submitButton;
  return null;
}

function handleNotebookLM(event) {
  if ((event.ctrlKey || event.metaKey) && event.code === "Enter") {
    event.preventDefault();
    event.stopImmediatePropagation();
    
    const sendButton = findSendButton();
    if (sendButton) {
      sendButton.click();
      return true;
    }
    return false;
  }
  return false;
}

function handleCtrlEnter(event) {
  if (!isHandleCtrlEnterEnabled){
    return;
  }
  const url = window.location.href;
  if (!shouldHandleCtrlEnter(url, event)){
    return;
  }

  // Special handling for NotebookLM
  if (url.startsWith("https://notebooklm.google.com")) {
    if (handleNotebookLM(event)) {
      return;
    }
  }

  const noModifierKeysDown = !(event.ctrlKey || event.shiftKey || event.metaKey)
  if (event.code == "Enter" && noModifierKeysDown){
    // Cancel Enter without any modifier key (Ctrl, Shift, meta)
    // Enter with Shift must NOT be canceled to prevent infinite loop
    if (shouldPreventDefault(url)) {
      event.preventDefault();
    }
    event.stopImmediatePropagation(); // Cancel keydown event handler of the website

    // Dispatch Shift+Enter instead
    const newEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter",
      ctrlKey: false,
      metaKey: false,
      shiftKey: true
    });
    event.target.dispatchEvent(newEvent);
  }
}

// This event handler should always be registered because it must be registered before event handlers of Claude
document.addEventListener("keydown", handleCtrlEnter, { capture: true });

chrome.storage.sync.get("isEnabled", (data) => {
  const isEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
  isHandleCtrlEnterEnabled = isEnabled;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && "isEnabled" in changes) {
    const isEnabled = changes.isEnabled.newValue;
    isHandleCtrlEnterEnabled = isEnabled;
  }
});
