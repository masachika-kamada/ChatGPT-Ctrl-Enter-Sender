const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const customInputsScriptPath = path.join(__dirname, "..", "content", "ctrl-enter-custom-inputs.js");
const customInputsScript = fs.readFileSync(customInputsScriptPath, "utf8");
const submitSelector = "button[type=\"submit\"]:not([disabled])";

function loadCustomInputs(url, sendButton) {
  const context = {
    window: { location: { href: url } },
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
    }
  };

  vm.createContext(context);
  vm.runInContext(customInputsScript, context, { filename: "ctrl-enter-custom-inputs.js" });
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

function createKeydownEvent(target, { ctrlKey = false, metaKey = false } = {}) {
  let preventDefaultCount = 0;
  let stopImmediatePropagationCount = 0;

  return {
    target,
    code: "Enter",
    ctrlKey,
    metaKey,
    isTrusted: true,
    isComposing: false,
    preventDefault() {
      preventDefaultCount += 1;
    },
    stopImmediatePropagation() {
      stopImmediatePropagationCount += 1;
    },
    get preventDefaultCount() {
      return preventDefaultCount;
    },
    get stopImmediatePropagationCount() {
      return stopImmediatePropagationCount;
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

test("Cursor Agents (/ja/agents) の Lexical 入力欄を対象にする", () => {
  const context = loadCustomInputs("https://cursor.com/ja/agents", createButton());
  const { target } = createLexicalTarget();

  const handled = context.shouldHandleCtrlEnter("https://cursor.com/ja/agents", { target });
  assert.equal(handled, true);
});

test("Cursor Agents 以外のパスは対象外にする", () => {
  const context = loadCustomInputs("https://cursor.com/ja/docs", createButton());
  const { target } = createLexicalTarget();

  const handled = context.shouldHandleCtrlEnter("https://cursor.com/ja/docs", { target });
  assert.equal(handled, false);
});

test("Cursor Agents の Enter は改行イベントに変換する", () => {
  const formSendButton = createButton();
  const context = loadCustomInputs("https://cursor.com/ja/agents", createButton());
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
  const context = loadCustomInputs("https://cursor.com/ja/agents", createButton());
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
  const context = loadCustomInputs("https://cursor.com/ja/agents", createButton());
  const { target, dispatchedEvents } = createLexicalTarget({ formSendButton });
  const event = createKeydownEvent(target, { metaKey: true });

  context.handleCtrlEnter(event);

  assert.equal(event.preventDefaultCount, 1);
  assert.equal(event.stopImmediatePropagationCount, 1);
  assert.equal(dispatchedEvents.length, 0);
  assert.equal(formSendButton.clickCount, 1);
});
