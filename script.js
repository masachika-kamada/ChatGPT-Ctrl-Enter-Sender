// document.addEventListener("click", (event) => {
//   console.log("target element:", event.target);
// });

chrome.storage.sync.get("isEnabled", (data) => {
  const isEnabled = data.isEnabled;
  if (isEnabled) {
    document.addEventListener("keydown", (event) => {
      if (event.target.tagName === "TEXTAREA" && event.code == "Enter" && !(event.ctrlKey || event.metaKey)) {
        event.stopPropagation();
      }
    }, { capture: true });
  }
});