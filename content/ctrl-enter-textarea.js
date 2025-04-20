function handleCtrlEnter(event) {
  if (event.target.tagName !== "TEXTAREA" || !event.isTrusted) {
    return;
  }

  const isOnlyEnter = (event.code === "Enter") && !(event.ctrlKey || event.metaKey);

  if (isOnlyEnter) {
    // stopPropagation for both Windows and Mac
    event.stopPropagation();
  }
}

// Apply the setting based on the current site on initial load
applySiteSetting();

// Listen for changes to the site settings and apply them dynamically
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.siteSettings) {
    applySiteSetting();
  }
});
