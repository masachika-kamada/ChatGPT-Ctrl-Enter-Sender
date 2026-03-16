/**
 * Site definitions for extension tests.
 *
 * Each entry describes:
 *   - url: page to navigate to
 *   - name: human-readable label
 *   - inputSelector: CSS selector for the chat input element
 *   - inputType: "textarea" | "contenteditable" | "prosemirror"
 *   - requiresAuth: whether the site requires login
 *   - waitForSelector: (optional) selector to wait for before interacting
 *   - notes: additional context
 */
const SITES = [
  {
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    inputSelector: "#prompt-textarea",
    inputType: "contenteditable",
    requiresAuth: true,
    notes: "Enter→改行, Ctrl+Enter→送信",
  },
  {
    name: "Claude",
    url: "https://claude.ai/new",
    inputSelector: 'div[contenteditable="true"]',
    inputType: "contenteditable",
    requiresAuth: true,
    notes: "Enter→改行, Ctrl+Enter→送信",
  },
  {
    name: "Gemini",
    url: "https://gemini.google.com/app",
    inputSelector: "div.ql-editor[contenteditable='true'], textarea",
    inputType: "contenteditable",
    requiresAuth: true,
    notes: "Enter→改行, Ctrl+Enter→送信",
  },
  {
    name: "DeepSeek",
    url: "https://chat.deepseek.com/",
    inputSelector: "textarea",
    inputType: "textarea",
    requiresAuth: true,
    notes: "Enter→改行, Ctrl+Enter→送信",
  },
  {
    name: "Grok",
    url: "https://grok.com/",
    inputSelector: "textarea, div[contenteditable='true']",
    inputType: "textarea",
    requiresAuth: false,
    notes: "認証不要で一部機能使える可能性",
  },
  {
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    inputSelector: 'div[contenteditable="true"]#ask-input',
    inputType: "contenteditable",
    requiresAuth: false,
    notes: "認証不要でトップページから利用可能",
  },
  {
    name: "Poe",
    url: "https://poe.com/",
    inputSelector: "textarea",
    inputType: "textarea",
    requiresAuth: true,
    notes: "Enter→改行 (stopPropagation), Ctrl+Enter→送信",
  },
  {
    name: "Mistral",
    url: "https://chat.mistral.ai/chat",
    inputSelector: "textarea",
    inputType: "textarea",
    requiresAuth: true,
    notes: "Enter→改行, Ctrl+Enter→送信",
  },
  {
    name: "Copilot",
    url: "https://copilot.microsoft.com/",
    inputSelector: "textarea",
    inputType: "textarea",
    requiresAuth: false,
    notes: "認証不要で利用可能",
  },
  {
    name: "NotebookLM",
    url: "https://notebooklm.google.com/",
    inputSelector: "textarea.query-box-input",
    inputType: "textarea",
    requiresAuth: true,
    notes: "Ctrl+Enter→ボタンクリックで送信",
  },
  {
    name: "Cursor Agents",
    url: "https://cursor.com/agents",
    inputSelector: 'div[data-lexical-editor="true"][role="textbox"]',
    inputType: "contenteditable",
    requiresAuth: true,
    notes: "Lexical editor。サブスクリプション必要",
  },
];

module.exports = { SITES };
