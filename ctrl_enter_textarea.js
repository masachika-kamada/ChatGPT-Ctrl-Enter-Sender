const browserOrChrome = typeof browser !== "undefined" ? browser : chrome;

function handleCtrlEnter(event) {
  if (event.target.tagName !== "TEXTAREA" || !event.isTrusted) {
    return;
  }

  const isOnlyEnter = (event.code === "Enter") && !(event.ctrlKey || event.metaKey);

  if (isOnlyEnter) {
    // stopPropagation for both Windows and Mac
    event.stopPropagation();
  }
}

function enableSendingWithCtrlEnter() {
  document.addEventListener("keydown", handleCtrlEnter, { capture: true });
}

function disableSendingWithCtrlEnter() {
  document.removeEventListener("keydown", handleCtrlEnter, { capture: true });
}

// Load stored settings and enable/disable the feature accordingly
browserOrChrome.storage.sync.get("isEnabled", (data) => {
  const isEnabled = data.isEnabled ?? true;
  if (isEnabled) {
    enableSendingWithCtrlEnter();
  }
});

// Listen for changes in the settings and update the feature state
browserOrChrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.hasOwnProperty("isEnabled")) {
    const isEnabled = changes.isEnabled.newValue;
    if (isEnabled) {
      enableSendingWithCtrlEnter();
    } else {
      disableSendingWithCtrlEnter();
    }
  }
});
