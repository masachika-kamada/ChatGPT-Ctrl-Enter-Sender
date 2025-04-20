function enableSendingWithCtrlEnter() {
  document.addEventListener("keydown", handleCtrlEnter, { capture: true });
}

function disableSendingWithCtrlEnter() {
  document.removeEventListener("keydown", handleCtrlEnter, { capture: true });
}

function getHostname() {
  return window.location.hostname;
}

function applySiteSetting() {
  const hostname = getHostname();

  chrome.storage.sync.get("siteSettings", (data) => {
    const settings = data.siteSettings || {};
    const isEnabled = settings[hostname] ?? false;

    if (isEnabled) {
      enableSendingWithCtrlEnter();
    } else {
      disableSendingWithCtrlEnter();
    }
  });
}
