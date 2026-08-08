import { SITE_CONFIGS, extractHostname } from "../constants/site-configs.js";
import { syncSiteRegistrations, syncOptionalContentScripts, injectIntoOpenTabs } from "../shared/site-sync.js";
import { localizePage } from "../shared/i18n.js";

localizePage();

// Repairs action rules and content-script registrations when the service
// worker is still running pre-update code (see shared/site-sync.js)
syncSiteRegistrations();

const toggleSection = document.querySelector("#toggleSection");
const shortcutHint = document.querySelector("#shortcutHint");
const grantSection = document.querySelector("#grantSection");
const unsupportedSection = document.querySelector("#unsupportedSection");
const toggleButton = document.querySelector("#isEnabled");
const grantButton = document.querySelector("#grantButton");
const statusMessage = document.querySelector("#statusMessage");

let currentTab = null;
let currentConfig = null;

// activeTab makes tab.url readable here even on sites without a granted
// host permission (opening the popup counts as invoking the extension)
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  currentTab = tabs[0];
  const hostname = extractHostname(currentTab.url);
  currentConfig = SITE_CONFIGS.find((c) => c.hostname === hostname) ?? null;

  if (!currentConfig) {
    unsupportedSection.hidden = false;
    return;
  }

  if (currentConfig.optional) {
    chrome.permissions.contains({ origins: currentConfig.matchPatterns }, (granted) => {
      if (granted) {
        showToggle();
      } else {
        grantSection.hidden = false;
      }
    });
  } else {
    showToggle();
  }
});

function showToggle() {
  grantSection.hidden = true;
  toggleSection.hidden = false;

  // A tab restored at browser startup can miss the manifest injection, and
  // opening the popup is what users try when the shortcut does nothing
  injectIntoOpenTabs([currentConfig]);

  // The shortcut is nowhere else in the UI, and users try Shift+Enter instead
  const isMac = navigator.userAgentData?.platform === "macOS" || navigator.platform.startsWith("Mac");
  shortcutHint.textContent = `${isMac ? "Cmd" : "Ctrl"} + Enter to send`;
  shortcutHint.hidden = false;

  chrome.storage.sync.get("siteSettings", (data) => {
    const siteSettings = data.siteSettings || {};
    const isEnabled = siteSettings[currentConfig.hostname] ?? true;
    toggleButton.checked = isEnabled;
    updateIcon(isEnabled, currentTab.id);
  });
}

toggleButton.addEventListener("change", () => {
  const isEnabled = toggleButton.checked;
  toggleButton.disabled = true;
  hideStatus();

  chrome.runtime.sendMessage({
    type: "update-site-settings",
    updates: { [currentConfig.hostname]: isEnabled },
  }, (response) => {
    const failed = chrome.runtime.lastError || !response?.ok;
    if (failed) {
      toggleButton.checked = !isEnabled;
      showStatus("Could not save this setting. Please try again.");
    } else {
      updateIcon(isEnabled, currentTab.id);
    }
    toggleButton.disabled = false;
  });
});

grantButton.addEventListener("click", () => {
  chrome.permissions.request({ origins: currentConfig.matchPatterns }, (granted) => {
    if (!granted) return;
    // Register here rather than in the service worker, then start the handler
    // in tabs that are already open so no reload is needed
    syncOptionalContentScripts()
      .then(() => injectIntoOpenTabs([currentConfig]))
      .then(showToggle, () => showStatus("Could not enable this site. Please try again."));
  });
});

function updateIcon(enabled, tabId) {
  chrome.action.setIcon({ tabId, path: enabled ? "/icon/enabled.png" : "/icon/disabled.png" });
  chrome.action.enable(tabId);
}

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.hidden = false;
}

function hideStatus() {
  statusMessage.hidden = true;
  statusMessage.textContent = "";
}
