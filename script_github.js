function handleCtrlEnter(event) {
  if (event.target.tagName !== "TEXTAREA") {
    return;
  }
  if (event.target.getAttribute("placeholder") !== "Ask Copilot") {
    return;
  }

  const isOnlyEnter = event.code == "Enter" && !(event.ctrlKey || event.metaKey || event.shiftKey);
  const isCtrlEnter = event.code == "Enter" && event.ctrlKey;

  if (isOnlyEnter) {
    event.stopPropagation();
    // Dispatch Shift+Enter instead
    const newEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter",
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
    });
    event.target.dispatchEvent(newEvent);
  } else if (isCtrlEnter) {
    event.stopPropagation();
    // Find the closest "form" or the next sibling of the textarea
    elm = event.target.closest("form") || event.target.nextElementSibling;
    if (!elm) {
      return;
    }
    // Find the last button (should be the "Send" button)
    buttons = elm.querySelectorAll('button[type="button"]')
    if (buttons.length === 0) {
      return;
    }
    buttons[buttons.length - 1].click(); // Click the "Send" button
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
