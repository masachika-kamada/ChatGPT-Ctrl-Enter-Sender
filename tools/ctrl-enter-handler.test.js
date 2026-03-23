const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const handlerScriptPath = path.join(__dirname, "..", "content", "ctrl-enter-handler.js");
const handlerScript = fs.readFileSync(handlerScriptPath, "utf8");
const submitSelector = 'button[type="submit"]:not([disabled])';

function loadHandler(url, sendButton) {
  const parsedUrl = new URL(url);
  const context = {
    window: { location: { href: url, hostname: parsedUrl.hostname } },
    URL,
    document: {
      querySelector: (selector) => (selector === submitSelector ? sendButton : null)
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
