function isCursorAgentsPath(url) {
  try {
    const { pathname } = new URL(url);
    // Support both /agents and locale-prefixed paths like /ja/agents.
    return /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?agents(?:\/|$)/.test(pathname);
  } catch (e) {
    return false;
  }
}

function shouldHandleCtrlEnter(url, event) {
  if (url.startsWith("https://claude.ai")) {
    // Support both main input (DIV) and edit mode (TEXTAREA)
    return (event.target.tagName === "DIV" && event.target.contentEditable === "true") ||
           event.target.tagName === "TEXTAREA";
  }
  else if (url.startsWith("https://notebooklm.google.com")) {
    return event.target.tagName === "TEXTAREA" && event.target.classList.contains("query-box-input");
  }
  else if (url.startsWith("https://gemini.google.com")) {
    return (
      (
        event.target.tagName === "DIV" &&
        event.target.classList.contains("ql-editor") &&
        event.target.contentEditable === "true"
      ) || (
        event.target.tagName === "TEXTAREA"
      )) &&
      !(event.shiftKey && event.code === "Enter");
  }
  else if (url.startsWith("https://chat.deepseek.com")) {
    return event.target.tagName === "TEXTAREA";
  }
  else if (url.startsWith("https://chat.mistral.ai")) {
    return (event.target.tagName === "DIV" &&
           event.target.classList.contains("ProseMirror") &&
           event.target.contentEditable === "true") ||
           event.target.tagName === "TEXTAREA";
  }
  else if (url.startsWith("https://grok.com")) {
    return event.target.tagName === "TEXTAREA" || (event.target.tagName === "DIV" && event.target.contentEditable === "true");
  }
  else if (url.startsWith("https://github.com/copilot")) {
    return event.target.tagName === "TEXTAREA";
  }
  else if (url.startsWith("https://m365.cloud.microsoft/chat")) {
    return event.target.id === "m365-chat-editor-target-element";
  }
  else if (url.startsWith("https://www.perplexity.ai")) {
    return event.target.tagName === "DIV" &&
           event.target.contentEditable === "true" &&
           event.target.id === "ask-input";
  }
  else if (url.startsWith("https://cursor.com")) {
    return isCursorAgentsPath(url) &&
           event.target.tagName === "DIV" &&
           event.target.contentEditable === "true" &&
           event.target.getAttribute("data-lexical-editor") === "true" &&
           event.target.getAttribute("role") === "textbox";
  }

  return false;
}

function findSendButton() {
  const submitButton = document.querySelector('query-box form button[type="submit"]');
  if (submitButton) return submitButton;
  return null;
}

function findCursorSendButton(target) {
  const submitSelector = 'button[type="submit"]:not([disabled])';

  const parentForm = target.closest("form");
  if (parentForm) {
    const formSubmitButton = parentForm.querySelector(submitSelector);
    if (formSubmitButton) return formSubmitButton;
  }

  return null;
}

function handleCtrlEnter(event) {
  const url = window.location.href;

  // Skip if composing (e.g., Japanese IME input)
  if (event.isComposing) {
    return;
  }

  if (!shouldHandleCtrlEnter(url, event) || !event.isTrusted) {
    return;
  }

  const isOnlyEnter = (event.code === "Enter") && !(event.ctrlKey || event.metaKey);
  const isCtrlEnter = (event.code === "Enter") && (event.ctrlKey || event.metaKey);
  const isCursorAgents = url.startsWith("https://cursor.com") && isCursorAgentsPath(url);

  if (isCursorAgents && isOnlyEnter) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const newEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      shiftKey: true
    });
    event.target.dispatchEvent(newEvent);
    return;
  }

  if (isCursorAgents && isCtrlEnter) {
    const sendButton = findCursorSendButton(event.target);
    if (sendButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      sendButton.click();
    }
    return;
  }

  if (isOnlyEnter || isCtrlEnter) {
    // Prevent default behavior only for certain sites
    const preventDefaultSites = ["https://claude.ai", "https://www.perplexity.ai", "https://chat.mistral.ai"];
    if (preventDefaultSites.some((site) => url.startsWith(site))) {
      event.preventDefault();
    }
    event.stopImmediatePropagation();

    let eventConfig = {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      shiftKey: isOnlyEnter
    };

    // M365 Chat requires keyCode=13 for Ctrl+Enter to send message
    if (url.startsWith("https://m365.cloud.microsoft/chat") && isCtrlEnter) {
      eventConfig.keyCode = 13;
    }

    // DeepSeek requires keyCode and composed for proper event handling
    if (url.startsWith("https://chat.deepseek.com")) {
      eventConfig.keyCode = 13;
      eventConfig.composed = true;
    }

    const newEvent = new KeyboardEvent("keydown", eventConfig);
    event.target.dispatchEvent(newEvent);
  }

  // NotebookLM requires clicking the send button instead of dispatching Enter
  if (isCtrlEnter && url.startsWith("https://notebooklm.google.com")) {
    const sendButton = findSendButton();
    if (sendButton) {
      sendButton.click();
    }
  }

  // Claude edit mode: TEXTAREA needs special handling
  if (url.startsWith("https://claude.ai") && event.target.tagName === "TEXTAREA") {
    if (isOnlyEnter) {
      // Insert newline at cursor position
      const textarea = event.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      textarea.value = value.substring(0, start) + "\n" + value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      // Trigger input event to notify the app of the change
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (isCtrlEnter) {
      // Click the save/submit button
      const saveButton = document.querySelector('button[type="submit"]');
      if (saveButton) {
        saveButton.click();
      }
    }
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
