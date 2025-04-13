function handleCtrlEnter(event) {
  const isOnlyEnter = (event.code === "Enter") && !(event.ctrlKey || event.metaKey);

  // Ignore untrusted events
  if (!event.isTrusted) return;

  if (event.target.id === "prompt-textarea" && isOnlyEnter) {
    event.preventDefault();
    const newEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,  // Simulate Shift+Enter to insert a line break
    });
    event.target.dispatchEvent(newEvent);
  }

  // On macOS, users can submit edits using the Meta key (Command key)
  // To allow submitting edits on Windows, convert Ctrl to Meta
  const isCtrlEnter = (event.code === "Enter") && event.ctrlKey;

  if (event.target.tagName === "TEXTAREA" && isCtrlEnter) {
    event.preventDefault();
    const newEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      ctrlKey: false,
      metaKey: true,  // Simulate Meta+Enter to trigger submit on Windows as well
      shiftKey: false,
    });
    event.target.dispatchEvent(newEvent);
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
