import { SUPPORTED_SITES } from "../constants/supported-sites.js";

const siteList = document.getElementById("siteList");
const selectAllCheckbox = document.getElementById("selectAll");
const saveButton = document.getElementById("saveButton");

// Render checkbox list based on the SUPPORTED_SITES array
function renderCheckboxes(savedSettings = {}) {
  siteList.innerHTML = '';
  SUPPORTED_SITES.forEach((hostname) => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = hostname;
    checkbox.checked = savedSettings[hostname] ?? true;

    const label = document.createElement("label");
    label.className = "site-label";
    label.appendChild(checkbox);
    label.append(` https://${hostname}`);

    siteList.appendChild(label);
  });
}

// Save settings to chrome.storage
function saveSettings() {
  const settings = {};
  SUPPORTED_SITES.forEach((hostname) => {
    const checkbox = document.getElementById(hostname);
    settings[hostname] = checkbox.checked;
  });

  chrome.storage.sync.set({ siteSettings: settings }, () => {
    const originalText = saveButton.textContent;
    saveButton.textContent = "Saved!";
    saveButton.disabled = true;
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
    if (checkbox) checkbox.checked = allChecked;
  });
});

// Save button click
saveButton.addEventListener("click", saveSettings);

// Load saved settings on page load
chrome.storage.sync.get("siteSettings", (data) => {
  renderCheckboxes(data.siteSettings || {});
});
