import { SITE_CONFIGS, SUPPORTED_SITES } from "../constants/site-configs.js";
import { syncSiteRegistrations, syncOptionalContentScripts } from "../shared/site-sync.js";
import { markNewSitesSeen } from "../shared/new-sites.js";
import { localizePage } from "../shared/i18n.js";

localizePage();
markNewSitesSeen();

// Repairs action rules and content-script registrations when the service
// worker is still running pre-update code (see shared/site-sync.js)
syncSiteRegistrations();

const siteList = document.getElementById("siteList");
const selectAllCheckbox = document.getElementById("selectAll");
const saveButton = document.getElementById("saveButton");
const dirtySites = new Set();

// Optional sites need a host permission granted by the user before their
// content script can run; ungranted ones get an "Allow access" button instead
// of a usable checkbox.
async function getUngrantedOptionalSites() {
  const ungranted = new Set();
  for (const config of SITE_CONFIGS) {
    if (!config.optional) continue;
    const granted = await chrome.permissions.contains({ origins: config.matchPatterns });
    if (!granted) ungranted.add(config.hostname);
  }
  return ungranted;
}

// Render checkbox list based on the SITE_CONFIGS array
function renderCheckboxes(savedSettings, ungrantedSites) {
  dirtySites.clear();
  siteList.innerHTML = '';
  SITE_CONFIGS.forEach((config) => {
    const hostname = config.hostname;
    const needsGrant = ungrantedSites.has(hostname);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = hostname;
    checkbox.checked = !needsGrant && (savedSettings[hostname] ?? true);
    checkbox.disabled = needsGrant;
    checkbox.addEventListener("change", () => dirtySites.add(hostname));

    const label = document.createElement("label");
    label.className = "site-label";
    label.appendChild(checkbox);
    label.append(` https://${hostname}`);

    if (needsGrant) {
      const grantButton = document.createElement("button");
      grantButton.type = "button";
      grantButton.className = "grant-button";
      grantButton.textContent = "Allow access";
      grantButton.addEventListener("click", () => {
        chrome.permissions.request({ origins: config.matchPatterns }, (granted) => {
          if (!granted) return;
          // Register here rather than in the service worker, then re-render
          syncOptionalContentScripts()
            .then(() => injectIntoOpenTabs([config]))
            .then(loadSettings, loadSettings);
        });
      });
      label.appendChild(grantButton);
    }

    siteList.appendChild(label);
  });
}

// Save settings to chrome.storage
function saveSettings() {
  const updates = {};
  dirtySites.forEach((hostname) => {
    const checkbox = document.getElementById(hostname);
    if (!checkbox || checkbox.disabled) return;
    updates[hostname] = checkbox.checked;
  });

  const originalText = saveButton.textContent;
  saveButton.disabled = true;

  if (Object.keys(updates).length === 0) {
    saveButton.textContent = "Saved!";
    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.disabled = false;
    }, 500);
    return;
  }

  saveButton.textContent = "Saving...";
  chrome.runtime.sendMessage({ type: "update-site-settings", updates }, (response) => {
    const failed = chrome.runtime.lastError || !response?.ok;
    saveButton.textContent = failed ? "Save failed" : "Saved!";

    if (!failed) {
      Object.entries(updates).forEach(([hostname, enabled]) => {
        const checkbox = document.getElementById(hostname);
        if (checkbox?.checked === enabled) dirtySites.delete(hostname);
      });
    }

    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.disabled = false;
    }, 500);
  });
}

// Handle Select All checkbox
selectAllCheckbox.addEventListener("change", () => {
  const allChecked = selectAllCheckbox.checked;
  SUPPORTED_SITES.forEach((hostname) => {
    const checkbox = document.getElementById(hostname);
    if (checkbox && !checkbox.disabled) {
      checkbox.checked = allChecked;
      dirtySites.add(hostname);
    }
  });
});

// Save button click
saveButton.addEventListener("click", saveSettings);

// Load saved settings on page load
async function loadSettings() {
  const ungrantedSites = await getUngrantedOptionalSites();
  chrome.storage.sync.get("siteSettings", (data) => {
    renderCheckboxes(data.siteSettings || {}, ungrantedSites);
  });
}

loadSettings();
