import { SITE_CONFIGS, extractHostname } from "../constants/site-configs.js";
import { syncSiteRegistrations, syncOptionalContentScripts } from "../shared/site-sync.js";

// Repairs action rules and content-script registrations when the service
// worker is still running pre-update code (see shared/site-sync.js)
syncSiteRegistrations();

const toggleSection = document.querySelector("#toggleSection");
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
    // Register here rather than in the service worker, then reload the page so
    // it takes effect immediately
    syncOptionalContentScripts().then(() => {
      chrome.tabs.reload(currentTab.id);
      showToggle();
    });
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
