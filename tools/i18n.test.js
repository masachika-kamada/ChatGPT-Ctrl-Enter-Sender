const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const localeDir = path.join(root, "_locales");
const pages = ["popup/popup.html", "options/options.html"];
const scripts = ["popup/popup.js", "options/options.js"];

function usedKeys() {
  const keys = new Set();
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    for (const match of html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)) keys.add(match[1]);
  }
  for (const script of scripts) {
    const source = fs.readFileSync(path.join(root, script), "utf8");
    for (const match of source.matchAll(/\bmessage\("([^"]+)"\)/g)) keys.add(match[1]);
  }
  return [...keys];
}

const locales = fs.readdirSync(localeDir);

test("拡張機能ページで使うメッセージが全ロケールに存在する", () => {
  const keys = usedKeys();
  assert.ok(keys.length > 0, "メッセージキーが検出できていない");

  for (const locale of locales) {
    const messages = JSON.parse(fs.readFileSync(path.join(localeDir, locale, "messages.json"), "utf8"));
    for (const key of keys) {
      assert.ok(messages[key]?.message, `${locale} に ${key} がない`);
    }
  }
});

test("全ロケールが同じメッセージキーを持つ", () => {
  const keysByLocale = locales.map((locale) => [
    locale,
    Object.keys(JSON.parse(fs.readFileSync(path.join(localeDir, locale, "messages.json"), "utf8"))).sort(),
  ]);
  const [baseLocale, baseKeys] = keysByLocale[0];

  for (const [locale, keys] of keysByLocale.slice(1)) {
    assert.deepEqual(keys, baseKeys, `${locale} のキーが ${baseLocale} と一致しない`);
  }
});
