let isEnabledCheckbox = document.getElementById("isEnabled");

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  if (tabs[0] && tabs[0].url) {
    chrome.storage.sync.get(tabs[0].url, function (data) {
      isEnabledCheckbox.checked = data[tabs[0].url];
    });
  }
});

isEnabledCheckbox.addEventListener("change", function () {
  let isEnabled = isEnabledCheckbox.checked;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0] && tabs[0].url) {
      chrome.storage.sync.set({ [tabs[0].url]: isEnabled });
      chrome.runtime.sendMessage({ isEnabled: isEnabled });
    }
  });
});

// ポップアップ内に表示されるトグルボタンを切り替えることで、上記の機能を有効または無効にする
// トグルボタンを使用して拡張機能を有効にした場合、アイコンを"enabled.png"に設定
// トグルボタンを使用して拡張機能を無効にした場合、アイコンを"disabled.png"に設定