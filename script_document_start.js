let isHandleCtrlEnterEnabled = false;

function shouldHandleCtrlEnter(url, event) {
  if (url.startsWith("https://claude.ai")) {
    return event.target.tagName === "DIV" && event.target.contentEditable === "true";
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

  const noModifierKeysDown = !(event.ctrlKey || event.shiftKey || event.metaKey)
  if (event.code == "Enter" && noModifierKeysDown){
    // Cancel Enter without any modifier key (Ctrl, Shift, meta)
    // Enter with Shift must NOT be canceled to prevent infinite loop
    event.preventDefault(); // Claude prevents default keydown event, so do I.
    event.stopImmediatePropagation(); // Cancel keydown event handler of Claude

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
