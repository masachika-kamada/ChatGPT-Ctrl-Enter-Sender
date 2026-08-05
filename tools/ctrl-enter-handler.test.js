const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const handlerScriptPath = path.join(__dirname, "..", "content", "ctrl-enter-handler.js");
const handlerScript = fs.readFileSync(handlerScriptPath, "utf8");
const submitSelector = 'button[type="submit"]:not([disabled])';
const notebookSubmitSelector = 'query-box form button[type="submit"]';
const chatgptSubmitSelector = 'button[data-testid$="send-button"]:not([disabled]), button[type="submit"]:not([disabled])';

function loadHandler(url, sendButton, documentButtonSelector = submitSelector) {
  const parsedUrl = new URL(url);
  const context = {
    window: { location: { href: url, hostname: parsedUrl.hostname } },
    URL,
    document: {
      querySelector: (selector) => {
        if (selector === documentButtonSelector || selector === submitSelector || selector === chatgptSubmitSelector) {
          if (sendButton && sendButton.disabled) return null;
          return sendButton;
        }
        return null;
      }
    },
    chrome: {
      storage: {
        onChanged: {
          addListener: () => {}
        }
      }
    },
    applySiteSetting: () => {},
    KeyboardEvent: class KeyboardEvent {
      constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
      }
    },
    Event: class Event {
      constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(handlerScript, context, { filename: "ctrl-enter-handler.js" });
  return context;
}

function createLexicalTarget({ formSendButton = null, attributes = {} } = {}) {
  const dispatchedEvents = [];
  const mergedAttributes = {
    "data-lexical-editor": "true",
    role: "textbox",
    ...attributes
  };

  const target = {
    tagName: "DIV",
    contentEditable: "true",
    getAttribute: (name) => mergedAttributes[name] ?? null,
    dispatchEvent: (event) => {
      dispatchedEvents.push(event);
      return true;
    },
    closest: (selector) => {
      if (selector !== "form" || !formSendButton) return null;
      return {
        querySelector: (query) => {
          if (query === submitSelector || query === chatgptSubmitSelector) {
            if (formSendButton && formSendButton.disabled) return null;
            return formSendButton;
          }
          return null;
        }
      };
    }
  };

  return { target, dispatchedEvents };
}

function createTextareaTarget({ value = "text", formSendButton = null } = {}) {
  const dispatchedEvents = [];
  const target = {
    tagName: "TEXTAREA",
    value,
    selectionStart: value.length,
    selectionEnd: value.length,
    dispatchEvent: (event) => {
      dispatchedEvents.push(event);
      return true;
    },
    closest: (selector) => {
      if (selector !== "form" || !formSendButton) return null;
      return {
        querySelector: (query) => (query === submitSelector ? formSendButton : null)
      };
    }
  };

  return { target, dispatchedEvents };
}

function createKeydownEvent(target, { ctrlKey = false, metaKey = false, shiftKey = false } = {}) {
  let preventDefaultCount = 0;
  let stopImmediatePropagationCount = 0;
  let stopPropagationCount = 0;

  return {
    target,
    code: "Enter",
    ctrlKey,
    metaKey,
    shiftKey,
    isTrusted: true,
    isComposing: false,
    preventDefault() {
      preventDefaultCount += 1;
    },
    stopImmediatePropagation() {
      stopImmediatePropagationCount += 1;
    },
    stopPropagation() {
      stopPropagationCount += 1;
    },
    get preventDefaultCount() {
      return preventDefaultCount;
    },
    get stopImmediatePropagationCount() {
      return stopImmediatePropagationCount;
    },
    get stopPropagationCount() {
      return stopPropagationCount;
    }
  };
}

function createButton({ disabled = false } = {}) {
  return {
    disabled,
    clickCount: 0,
    click() {
      this.clickCount += 1;
    }
  };
}

// ── Cursor Agents tests ──────────────────────────────────────────────────────

test("Cursor Agents (/ja/agents) の Lexical 入力欄を対象にする", () => {
  const formSendButton = createButton();
  const context = loadHandler("https://cursor.com/ja/agents", createButton());
  const { target } = createLexicalTarget({ formSendButton });
  const event = createKeydownEvent(target);

  context.handleCtrlEnter(event);

  // shouldHandle returned true → handler ran (preventDefault was called)
  assert.equal(event.preventDefaultCount, 1);
});

test("Cursor Agents 以外のパスは対象外にする", () => {
  const context = loadHandler("https://cursor.com/ja/docs", createButton());
  const { target } = createLexicalTarget();
  const event = createKeydownEvent(target);

  context.handleCtrlEnter(event);

  // shouldHandle returned false → handler did not run
  assert.equal(event.preventDefaultCount, 0);
  assert.equal(event.stopImmediatePropagationCount, 0);
});

test("Cursor Agents の Enter は改行イベントに変換する", () => {
  const formSendButton = createButton();
  const context = loadHandler("https://cursor.com/ja/agents", createButton());
  const { target, dispatchedEvents } = createLexicalTarget({ formSendButton });
  const event = createKeydownEvent(target);

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 1);
  assert.equal(event.stopImmediatePropagationCount, 1);
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].type, "keydown");
  assert.equal(dispatchedEvents[0].shiftKey, true);
  assert.equal(formSendButton.clickCount, 0);
});

test("Cursor Agents の Ctrl+Enter は form 内送信ボタンをクリックする", () => {
  const formSendButton = createButton();
  const context = loadHandler("https://cursor.com/ja/agents", createButton());
  const { target, dispatchedEvents } = createLexicalTarget({ formSendButton });
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 1);
  assert.equal(event.stopImmediatePropagationCount, 1);
  assert.equal(dispatchedEvents.length, 0);
  assert.equal(formSendButton.clickCount, 1);
});

test("Cursor Agents の Meta+Enter は form 内送信ボタンをクリックする", () => {
  const formSendButton = createButton();
  const context = loadHandler("https://cursor.com/ja/agents", createButton());
  const { target, dispatchedEvents } = createLexicalTarget({ formSendButton });
  const event = createKeydownEvent(target, { metaKey: true });

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 1);
  assert.equal(event.stopImmediatePropagationCount, 1);
  assert.equal(dispatchedEvents.length, 0);
  assert.equal(formSendButton.clickCount, 1);
});

// ── Other optional-site tests ───────────────────────────────────────────────

test("Genspark の TEXTAREA で Enter はカーソル位置に改行を挿入する", () => {
  const context = loadHandler("https://www.genspark.ai/", createButton());
  const { target, dispatchedEvents } = createTextareaTarget({ value: "ab" });
  target.selectionStart = target.selectionEnd = 1;
  const event = createKeydownEvent(target);

  context.handleCtrlEnter(event);

  assert.equal(target.value, "a\nb");
  assert.equal(target.selectionStart, 2);
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].type, "input");
  assert.equal(event.preventDefaultCount, 1);
  assert.equal(event.stopImmediatePropagationCount, 1);
});

test("Genspark の TEXTAREA で Ctrl+Enter は送信ボタンを一度クリックする", () => {
  const sendButton = createButton();
  const context = loadHandler("https://www.genspark.ai/", sendButton, ".enter-icon-wrapper");
  const { target } = createTextareaTarget();
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(sendButton.clickCount, 1);
  assert.equal(event.preventDefaultCount, 1);
  assert.equal(event.stopImmediatePropagationCount, 1);
});

test("duck.ai の TEXTAREA で Enter はカーソル位置に改行を挿入する", () => {
  const context = loadHandler("https://duck.ai/", createButton());
  const { target, dispatchedEvents } = createTextareaTarget({ value: "ab" });
  target.selectionStart = target.selectionEnd = 1;
  const event = createKeydownEvent(target);

  context.handleCtrlEnter(event);

  assert.equal(target.value, "a\nb");
  assert.equal(target.selectionStart, 2);
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].type, "input");
});

test("duck.ai の TEXTAREA で Ctrl+Enter は form 内送信ボタンを一度クリックする", () => {
  const sendButton = createButton();
  const context = loadHandler("https://duck.ai/", createButton());
  const { target } = createTextareaTarget({ formSendButton: sendButton });
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(sendButton.clickCount, 1);
  assert.equal(event.preventDefaultCount, 1);
  assert.equal(event.stopImmediatePropagationCount, 1);
});

test("Manus の Enter は Shift+Enter にマッピングする", () => {
  const dispatchedEvents = [];
  const target = {
    tagName: "DIV",
    contentEditable: "true",
    classList: { contains: (name) => name === "ProseMirror" },
    dispatchEvent: (event) => {
      dispatchedEvents.push(event);
      return true;
    }
  };
  const context = loadHandler("https://manus.im/", createButton());
  const event = createKeydownEvent(target);

  context.handleCtrlEnter(event);

  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].shiftKey, true);
  assert.equal(event.preventDefaultCount, 1);
});

test("Manus の Ctrl+Enter は通常 Enter にマッピングする", () => {
  const dispatchedEvents = [];
  const target = {
    tagName: "DIV",
    contentEditable: "true",
    classList: { contains: (name) => name === "ProseMirror" },
    dispatchEvent: (event) => {
      dispatchedEvents.push(event);
      return true;
    }
  };
  const context = loadHandler("https://manus.im/", createButton());
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].shiftKey, undefined);
  assert.equal(event.preventDefaultCount, 1);
});

// ── NotebookLM tests ────────────────────────────────────────────────────────

test("NotebookLM の Ctrl+Enter は送信ボタンだけを一度クリックする", () => {
  const sendButton = createButton();
  const context = loadHandler(
    "https://notebooklm.google.com/",
    sendButton,
    notebookSubmitSelector
  );
  const { target, dispatchedEvents } = createTextareaTarget();
  target.classList = { contains: (name) => name === "query-box-input" };
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(sendButton.clickCount, 1);
  assert.equal(dispatchedEvents.length, 0);
  assert.equal(event.preventDefaultCount, 1);
  assert.equal(event.stopImmediatePropagationCount, 1);
});

test("NotebookLM の送信ボタンがない場合は通常 Enter にフォールバックする", () => {
  const context = loadHandler(
    "https://notebooklm.google.com/",
    null,
    notebookSubmitSelector
  );
  const { target, dispatchedEvents } = createTextareaTarget();
  target.classList = { contains: (name) => name === "query-box-input" };
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].shiftKey, undefined);
  assert.equal(event.preventDefaultCount, 1);
  assert.equal(event.stopImmediatePropagationCount, 1);
});

// ── General behavior tests ───────────────────────────────────────────────────

test("isComposing な場合はハンドリングしない", () => {
  const context = loadHandler("https://chatgpt.com/", createButton());
  const { target, dispatchedEvents } = createLexicalTarget();
  const event = createKeydownEvent(target);
  event.isComposing = true;
  event.target = { id: "prompt-textarea", tagName: "DIV" };

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 0);
  assert.equal(dispatchedEvents.length, 0);
});

test("isTrusted=false な場合はハンドリングしない", () => {
  const context = loadHandler("https://chatgpt.com/", createButton());
  const event = createKeydownEvent({ id: "prompt-textarea", tagName: "DIV" });
  event.isTrusted = false;

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 0);
});

test("対象外ホストではハンドリングしない", () => {
  const context = loadHandler("https://example.com/", createButton());
  const event = createKeydownEvent({ tagName: "TEXTAREA" });

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 0);
  assert.equal(event.stopImmediatePropagationCount, 0);
  assert.equal(event.stopPropagationCount, 0);
});

// ── Textarea strategy tests (Poe/v0/Copilot) ────────────────────────────────

test("Poe の TEXTAREA で Enter は stopPropagation のみ", () => {
  const context = loadHandler("https://poe.com/", createButton());
  const event = createKeydownEvent({ tagName: "TEXTAREA" });

  context.handleCtrlEnter(event);

  assert.equal(event.stopPropagationCount, 1);
  assert.equal(event.preventDefaultCount, 0);
  assert.equal(event.stopImmediatePropagationCount, 0);
});

test("Poe の TEXTAREA で Ctrl+Enter はパススルー", () => {
  const context = loadHandler("https://poe.com/", createButton());
  const event = createKeydownEvent({ tagName: "TEXTAREA" }, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(event.stopPropagationCount, 0);
  assert.equal(event.preventDefaultCount, 0);
});

test("Copilot の TEXTAREA で Enter は stopImmediatePropagation のみ", () => {
  const context = loadHandler("https://copilot.microsoft.com/", createButton());
  const event = createKeydownEvent({ tagName: "TEXTAREA" });

  context.handleCtrlEnter(event);

  assert.equal(event.stopImmediatePropagationCount, 1);
  assert.equal(event.stopPropagationCount, 0);
  assert.equal(event.preventDefaultCount, 0);
});

test("Copilot の TEXTAREA で Ctrl+Enter はパススルー", () => {
  const context = loadHandler("https://copilot.microsoft.com/", createButton());
  const event = createKeydownEvent({ tagName: "TEXTAREA" }, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(event.stopImmediatePropagationCount, 0);
  assert.equal(event.stopPropagationCount, 0);
  assert.equal(event.preventDefaultCount, 0);
});

// ── ChatGPT tests ────────────────────────────────────────────────────────────

function createChatGPTTarget({ formSendButton = null, id = "prompt-textarea", tagName = "DIV" } = {}) {
  const dispatchedEvents = [];
  const target = {
    id,
    tagName,
    dispatchEvent: (e) => { dispatchedEvents.push(e); return true; },
    closest: (selector) => {
      if (selector !== "form" || !formSendButton) return null;
      return {
        querySelector: (query) => {
          if (query === submitSelector || query === chatgptSubmitSelector) {
            if (formSendButton && formSendButton.disabled) return null;
            return formSendButton;
          }
          return null;
        }
      };
    }
  };
  return { target, dispatchedEvents };
}

test("ChatGPT の prompt-textarea で Enter は Shift+Enter にマッピング", () => {
  const { target, dispatchedEvents } = createChatGPTTarget();
  const context = loadHandler("https://chatgpt.com/", createButton());
  const event = createKeydownEvent(target);

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 1);
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].shiftKey, true);
});

test("ChatGPT で Ctrl+Enter 時、form 内に有効な submit button があれば click される", () => {
  const formSendButton = createButton();
  const { target, dispatchedEvents } = createChatGPTTarget({ formSendButton });
  const context = loadHandler("https://chatgpt.com/", formSendButton);
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 1);
  assert.equal(dispatchedEvents.length, 0); // button is clicked, so no synthetic enter is dispatched
  assert.equal(formSendButton.clickCount, 1);
});

test("ChatGPT で Ctrl+Enter 時、有効な submit button がなければ従来通り Meta+Enter を dispatch する", () => {
  const { target, dispatchedEvents } = createChatGPTTarget({ formSendButton: null });
  const context = loadHandler("https://chatgpt.com/", null);
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 1);
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].metaKey, true);
});

test("ChatGPT で Ctrl+Enter 時、disabled button はクリックしない（fallback する）", () => {
  const formSendButton = createButton({ disabled: true });
  const { target, dispatchedEvents } = createChatGPTTarget({ formSendButton });
  const context = loadHandler("https://chatgpt.com/", formSendButton);
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 1);
  assert.equal(dispatchedEvents.length, 1); // falls back to Meta+Enter
  assert.equal(dispatchedEvents[0].metaKey, true);
  assert.equal(formSendButton.clickCount, 0); // button not clicked
});

test("ChatGPT の Meta+Enter はパススルー（Mac ネイティブ送信）", () => {
  const { target, dispatchedEvents } = createChatGPTTarget();
  const context = loadHandler("https://chatgpt.com/", createButton());
  const event = createKeydownEvent(target, { metaKey: true });

  context.handleCtrlEnter(event);

  // onCtrlEnter checks event.ctrlKey specifically, so metaKey-only is a no-op
  assert.equal(event.preventDefaultCount, 0);
  assert.equal(dispatchedEvents.length, 0);
});
