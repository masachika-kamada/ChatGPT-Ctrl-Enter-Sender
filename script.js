// document.addEventListener("click", (event) => {
//   console.log("target element:", event.target);
// });

function handleCtrlEnter(event) {
  if (event.target.id === "prompt-textarea") {
    if (
      event.target.tagName === "TEXTAREA" &&
      event.code == "Enter" &&
      !(event.ctrlKey || event.metaKey)
    ) {
      event.stopPropagation();
    }
  } else {
    if (event.target === document.querySelectorAll("textarea")[0]) {
      if (event.ctrlKey && event.code == "Enter") {
        const newEvent = new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
          code: "Enter",
          ctrlKey: false,
          metaKey: true
        });
        event.target.dispatchEvent(newEvent);
      }
    }
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
