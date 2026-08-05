const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const siteSyncPath = path.join(__dirname, "..", "shared", "site-sync.js");
const siteConfigsPath = path.join(__dirname, "..", "constants", "site-configs.js");
const contentScriptFiles = ["content/ctrl-enter-utils.js", "content/ctrl-enter-handler.js"];

// The extension ships ES modules but package.json declares commonjs, so the
// sources are imported as data URLs, which are always treated as modules
function toDataUrl(source) {
  return "data:text/javascript;base64," + Buffer.from(source, "utf8").toString("base64");
}

// Each test needs its own module instance because the queues are module state
async function loadSiteSync() {
  const configsUrl = toDataUrl(fs.readFileSync(siteConfigsPath, "utf8"));
  const source = fs
    .readFileSync(siteSyncPath, "utf8")
    .replace("../constants/site-configs.js", configsUrl)
    .concat(`\n// ${Math.random()}\n`);
  const [siteSync, configs] = await Promise.all([import(toDataUrl(source)), import(configsUrl)]);
  return { ...siteSync, ...configs };
}

function createChrome({ rules = [], registered = [], granted = [] } = {}) {
  const calls = { removeRules: 0, addRules: [], register: [], update: [], unregister: [] };
  let currentRules = rules;

  globalThis.chrome = {
    runtime: { lastError: null },
    declarativeContent: {
      PageStateMatcher: class {
        constructor(options) {
          Object.assign(this, options);
        }
      },
      ShowAction: class { },
      onPageChanged: {
        getRules: (callback) => callback(currentRules),
        removeRules: (ids, callback) => {
          calls.removeRules += 1;
          currentRules = [];
          callback();
        },
        addRules: (added, callback) => {
          calls.addRules.push(...added);
          currentRules = currentRules.concat(added);
          callback();
        },
      },
    },
    permissions: {
      contains: async ({ origins }) => origins.every((origin) => granted.includes(origin)),
    },
    scripting: {
      getRegisteredContentScripts: async () => registered,
      registerContentScripts: async (scripts) => calls.register.push(...scripts),
      updateContentScripts: async (scripts) => calls.update.push(...scripts),
      unregisterContentScripts: async ({ ids }) => calls.unregister.push(...ids),
    },
  };

  return { calls, getRules: () => currentRules };
}

function toRuleRegex(pattern) {
  return "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
}

test("古いルールは固定 ID の単一ルールに置き換えられる", async () => {
  const { calls } = createChrome({
    rules: [{ id: "legacy", conditions: [{ pageUrl: { urlMatches: "^https://chatgpt\\.com/.*$" } }] }],
  });
  const { ensureActionRules, SITE_CONFIGS } = await loadSiteSync();

  await ensureActionRules();

  assert.equal(calls.removeRules, 1);
  assert.equal(calls.addRules.length, 1);
  assert.equal(calls.addRules[0].id, "supported-sites");

  const registered = calls.addRules[0].conditions.map((condition) => condition.pageUrl.urlMatches);
  const expected = SITE_CONFIGS.flatMap((config) => config.matchPatterns.map(toRuleRegex));
  assert.deepEqual(registered.slice().sort(), expected.slice().sort());
});

test("ルールが最新なら書き換えない", async () => {
  const { ensureActionRules, SITE_CONFIGS } = await loadSiteSync();
  const conditions = SITE_CONFIGS.flatMap((config) =>
    config.matchPatterns.map((pattern) => ({ pageUrl: { urlMatches: toRuleRegex(pattern) } }))
  );
  const { calls } = createChrome({ rules: [{ id: "supported-sites", conditions }] });

  await ensureActionRules();

  assert.equal(calls.removeRules, 0);
  assert.equal(calls.addRules.length, 0);
});

test("同時に呼ばれてもルールは重複しない", async () => {
  const { getRules } = createChrome({ rules: [{ id: "legacy", conditions: [] }] });
  const { ensureActionRules } = await loadSiteSync();

  await Promise.all([ensureActionRules(), ensureActionRules(), ensureActionRules()]);

  assert.equal(getRules().length, 1);
  assert.equal(getRules()[0].id, "supported-sites");
});

test("許可済みの opt-in サイトはコンテンツスクリプトが登録される", async () => {
  const { syncOptionalContentScripts, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const { calls } = createChrome({ granted: target.matchPatterns });

  await syncOptionalContentScripts();

  assert.deepEqual(calls.register.map((script) => script.id), [target.hostname]);
  assert.deepEqual(calls.register[0].matches, target.matchPatterns);
  assert.deepEqual(calls.register[0].js, contentScriptFiles);
  assert.equal(calls.register[0].runAt, "document_start");
});

test("登録済みでも match パターンが古ければ更新される", async () => {
  const { syncOptionalContentScripts, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const { calls } = createChrome({
    granted: target.matchPatterns,
    registered: [
      { id: target.hostname, matches: ["https://outdated.example/*"], js: contentScriptFiles, runAt: "document_start" },
    ],
  });

  await syncOptionalContentScripts();

  assert.equal(calls.register.length, 0);
  assert.deepEqual(calls.update.map((script) => script.id), [target.hostname]);
  assert.deepEqual(calls.update[0].matches, target.matchPatterns);
});

test("許可が取り消されたサイトは登録解除される", async () => {
  const { syncOptionalContentScripts, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const { calls } = createChrome({
    registered: [
      { id: target.hostname, matches: target.matchPatterns, js: contentScriptFiles, runAt: "document_start" },
    ],
  });

  await syncOptionalContentScripts();

  assert.deepEqual(calls.unregister, [target.hostname]);
});

test("未許可のサイトには何も登録しない", async () => {
  const { syncOptionalContentScripts } = await loadSiteSync();
  const { calls } = createChrome();

  await syncOptionalContentScripts();

  assert.equal(calls.register.length, 0);
  assert.equal(calls.update.length, 0);
  assert.equal(calls.unregister.length, 0);
});
