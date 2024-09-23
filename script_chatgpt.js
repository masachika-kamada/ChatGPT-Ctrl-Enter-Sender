function handleCtrlEnter(event) {
  if (event.target.id !== "prompt-textarea") {
    return;
  }

  const isOnlyEnter = event.code == "Enter" && !(event.ctrlKey || event.metaKey);
  const isCtrlEnter = event.code == "Enter" && event.ctrlKey;

  if (isOnlyEnter) {
    event.preventDefault();
    let newEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    event.target.dispatchEvent(newEvent);
  } else if (isCtrlEnter) {
    // Dispatch event only on Windows
    // Use metaKey on Windows to enable editing confirmation on the ChatGPT page, similar to Mac
    event.preventDefault();
    let newEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter",
      ctrlKey: false,
      metaKey: true,
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

chrome.storage.sync.get("isEnabled", (data) => {
  const isEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
  if (isEnabled) {
    enableSendingWithCtrlEnter();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && "isEnabled" in changes) {
    const isEnabled = changes.isEnabled.newValue;
    if (isEnabled) {
      enableSendingWithCtrlEnter();
    } else {
      disableSendingWithCtrlEnter();
    }
  }
});
