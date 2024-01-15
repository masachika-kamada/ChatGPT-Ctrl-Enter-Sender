function isPromptTextAreaFunc(target, url) {
  if (url.startsWith("https://chat.openai.com")) {
    return target.tagName === "TEXTAREA" && target.id === "prompt-textarea";
  } else if (url.startsWith("https://www.phind.com")) {
    return (
      target.tagName === "TEXTAREA" &&
      target.getAttribute("aria-label") === "Send message"
    );
  } else if (url.startsWith("https://bard.google.com")) {
    return target.getAttribute("aria-label") === "Input for prompt text";
  }

  return target.tagName === "TEXTAREA";
}

function handleCtrlEnter(event) {
  const url = window.location.href;

  const isPromptTextArea = isPromptTextAreaFunc(event.target, url);
  if (!isPromptTextArea) {
    return;
  }

  const isOnlyEnter =
    event.code == "Enter" && !(event.ctrlKey || event.metaKey);

  const isCtrlEnter = event.ctrlKey && event.code == "Enter";

  if (isOnlyEnter) {
    event.stopPropagation();
  } else if (isCtrlEnter) {
    const newEvent = new KeyboardEvent("keydown", {
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
