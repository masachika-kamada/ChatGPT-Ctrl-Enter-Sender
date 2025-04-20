const SITES = [
  "https://chatgpt.com",
  "https://poe.com",
  "https://www.phind.com",
  "https://chat.mistral.ai",
  "https://www.perplexity.ai",
  "https://claude.ai",
  "https://you.com",
  "https://v0.dev",
  "https://dashboard.cohere.com",
  "https://notebooklm.google.com",
  "https://gemini.google.com",
  "https://chat.deepseek.com",
  "https://github.com",
  "https://grok.com",
  "https://copilot.microsoft.com"
];

const siteList = document.getElementById("siteList");
const selectAllCheckbox = document.getElementById("selectAll");
const saveButton = document.getElementById("saveButton");

// Extract the hostname from a URL
function extractHostname(url) {
  const a = document.createElement("a");
  a.href = url;
  return a.hostname;
}

// Render checkbox list based on the SITES array
function renderCheckboxes(savedSettings = {}) {
  siteList.innerHTML = '';
  SITES.forEach((url) => {
    const hostname = extractHostname(url);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = hostname;
    checkbox.checked = savedSettings[hostname] || false;

    const label = document.createElement("label");
    label.className = "site-label";
    label.appendChild(checkbox);
    label.append(` ${url}`);

    siteList.appendChild(label);
  });
}

// Save settings to chrome.storage
function saveSettings() {
  const settings = {};
  SITES.forEach((url) => {
    const hostname = extractHostname(url);
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
  SITES.forEach((url) => {
    const hostname = extractHostname(url);
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
