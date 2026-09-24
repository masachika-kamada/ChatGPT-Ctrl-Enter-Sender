// ChatGPT's background-send shortcut listens on window, ahead of a document listener
function getListenerTarget() {
  return getHostname() === "chatgpt.com" ? window : document;
}

function enableSendingWithCtrlEnter() {
  getListenerTarget().addEventListener("keydown", handleCtrlEnter, { capture: true });
}

function disableSendingWithCtrlEnter() {
  getListenerTarget().removeEventListener("keydown", handleCtrlEnter, { capture: true });
}

function getHostname() {
  return window.location.hostname;
}

function applySiteSetting() {
  const hostname = getHostname();

  chrome.storage.sync.get("siteSettings", (data) => {
    const settings = data.siteSettings || {};
    const isEnabled = settings[hostname] ?? true;

    if (isEnabled) {
      enableSendingWithCtrlEnter();
    } else {
      disableSendingWithCtrlEnter();
    }
  });
}
