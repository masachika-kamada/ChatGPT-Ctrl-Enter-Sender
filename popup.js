let isEnabled = false;
const toggleButton = document.querySelector("#isEnabled");

chrome.storage.sync.get("isEnabled", (data) => {
  isEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
  toggleButton.checked = isEnabled;
  updateIcon();
});

toggleButton.addEventListener("change", () => {
  isEnabled = toggleButton.checked;
  chrome.storage.sync.set({ isEnabled });
  updateIcon();
});

function updateIcon() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url ?? "";
    if (url.startsWith("https://chat.openai.com") ||
        url.startsWith("https://poe.com") ||
        url.startsWith("https://www.phind.com") ||
        url.startsWith("https://chat.mistral.ai") ||
        url.startsWith("https://www.chatpdf.com") ||
        url.startsWith("https://www.perplexity.ai") ||
        url.startsWith("https://claude.ai")) {
      chrome.action.setIcon({ path: isEnabled ? "icon/enabled.png" : "icon/disabled.png" });
    }
  });
}
