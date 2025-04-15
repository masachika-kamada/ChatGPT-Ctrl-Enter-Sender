function handleCtrlEnter(event) {
  const isOnlyEnter = (event.code === "Enter") && !(event.ctrlKey || event.metaKey);
  const isCtrlEnter = (event.code === "Enter") && event.ctrlKey;
  const isPromptTextarea = event.target.id === "prompt-textarea";

  // Ignore untrusted events
  if (!event.isTrusted) return;

  // Specific handling for ChatGPT's prompt textarea
  if (isPromptTextarea && isOnlyEnter) {
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
  else if (isPromptTextarea && isCtrlEnter) {
    event.preventDefault();
    const newEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      ctrlKey: false,
      metaKey: true,  // ChatGPT UI ignores Ctrl+Enter in narrow (mobile/sidebar) view; simulate Meta+Enter instead to ensure submission
      shiftKey: false,
    });
    event.target.dispatchEvent(newEvent);
  }

  // On macOS, users can submit edits using the Meta key (Command key)
  // To allow submitting edits on Windows, convert Ctrl to Meta
  else if (event.target.tagName === "TEXTAREA" && isCtrlEnter) {
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
