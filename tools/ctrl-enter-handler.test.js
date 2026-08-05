const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const handlerScriptPath = path.join(__dirname, "..", "content", "ctrl-enter-handler.js");
const handlerScript = fs.readFileSync(handlerScriptPath, "utf8");
const submitSelector = 'button[type="submit"]:not([disabled])';
const notebookSubmitSelector = 'query-box form button[type="submit"]';
const claudeSaveSelector = 'button:not([disabled]):has(> span.bg-fill-primary)';

function loadHandler(url, sendButton, documentButtonSelector = submitSelector) {
  const parsedUrl = new URL(url);
  const context = {
    window: { location: { href: url, hostname: parsedUrl.hostname } },
    URL,
    document: {
      querySelector: (selector) => (selector === documentButtonSelector ? sendButton : null)
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
        querySelector: (query) => (query === submitSelector ? formSendButton : null)
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

function createClaudeEditTarget({ saveButton = null, value = "text" } = {}) {
  const dispatchedEvents = [];
  const message = {
    querySelector: (query) => (query === claudeSaveSelector ? saveButton : null)
  };
  const target = {
    tagName: "TEXTAREA",
    value,
    selectionStart: value.length,
    selectionEnd: value.length,
    dispatchEvent: (event) => {
      dispatchedEvents.push(event);
      return true;
    },
    closest: (selector) => (selector === '[data-cds="UserMessage"]' ? message : null)
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

function createButton() {
  return {
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

// ── Claude tests ────────────────────────────────────────────────────────────

test("Claude の編集 TEXTAREA で Enter はカーソル位置に改行を挿入する", () => {
  const saveButton = createButton();
  const context = loadHandler("https://claude.ai/chat/abc", createButton());
  const { target, dispatchedEvents } = createClaudeEditTarget({ saveButton, value: "ab" });
  target.selectionStart = target.selectionEnd = 1;
  const event = createKeydownEvent(target);

  context.handleCtrlEnter(event);

  assert.equal(target.value, "a\nb");
  assert.equal(target.selectionStart, 2);
  assert.equal(saveButton.clickCount, 0);
  assert.equal(dispatchedEvents.at(-1).type, "input");
  assert.equal(event.preventDefaultCount, 1);
});

test("Claude の編集 TEXTAREA で Ctrl+Enter は保存ボタンを一度クリックする", () => {
  const saveButton = createButton();
  const context = loadHandler("https://claude.ai/chat/abc", createButton());
  const { target, dispatchedEvents } = createClaudeEditTarget({ saveButton });
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(saveButton.clickCount, 1);
  assert.equal(dispatchedEvents.length, 0);
  assert.equal(event.preventDefaultCount, 1);
  assert.equal(event.stopImmediatePropagationCount, 1);
});

test("Claude の保存ボタンが見つからない場合は通常 Enter にフォールバックする", () => {
  const context = loadHandler("https://claude.ai/chat/abc", createButton());
  const { target, dispatchedEvents } = createClaudeEditTarget();
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].type, "keydown");
  assert.equal(dispatchedEvents[0].shiftKey, undefined);
});

test("Claude の入力欄（contenteditable）の Ctrl+Enter は通常 Enter を送る", () => {
  const dispatchedEvents = [];
  const target = {
    tagName: "DIV",
    contentEditable: "true",
    dispatchEvent: (e) => { dispatchedEvents.push(e); return true; }
  };
  const context = loadHandler("https://claude.ai/chat/abc", createButton());
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].shiftKey, undefined);
  assert.equal(event.preventDefaultCount, 1);
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

test("ChatGPT の prompt-textarea で Enter は Shift+Enter にマッピング", () => {
  const dispatchedEvents = [];
  const target = {
    id: "prompt-textarea",
    tagName: "DIV",
    dispatchEvent: (e) => { dispatchedEvents.push(e); return true; }
  };
  const context = loadHandler("https://chatgpt.com/", createButton());
  const event = createKeydownEvent(target);

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 1);
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].shiftKey, true);
});

test("ChatGPT の prompt-textarea で Ctrl+Enter は Meta+Enter にマッピング", () => {
  const dispatchedEvents = [];
  const target = {
    id: "prompt-textarea",
    tagName: "DIV",
    dispatchEvent: (e) => { dispatchedEvents.push(e); return true; }
  };
  const context = loadHandler("https://chatgpt.com/", createButton());
  const event = createKeydownEvent(target, { ctrlKey: true });

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 1);
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].metaKey, true);
});

test("ChatGPT の Meta+Enter はパススルー（Mac ネイティブ送信）", () => {
  const dispatchedEvents = [];
  const target = {
    id: "prompt-textarea",
    tagName: "DIV",
    dispatchEvent: (e) => { dispatchedEvents.push(e); return true; }
  };
  const context = loadHandler("https://chatgpt.com/", createButton());
  const event = createKeydownEvent(target, { metaKey: true });

  context.handleCtrlEnter(event);

  // onCtrlEnter checks event.ctrlKey specifically, so metaKey-only is a no-op
  assert.equal(event.preventDefaultCount, 0);
  assert.equal(dispatchedEvents.length, 0);
});
