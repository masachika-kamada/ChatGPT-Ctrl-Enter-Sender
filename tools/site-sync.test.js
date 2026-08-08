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

function createChrome({ rules = [], registered = [], granted = [], storage = {}, failWrites = false, tabs = [], loadedTabIds = [] } = {}) {
  const calls = { removeRules: 0, addRules: [], register: [], update: [], unregister: [], injected: [] };
  let currentRules = rules;
  let currentScripts = registered;

  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get: async (key) => (key in storage ? { [key]: storage[key] } : {}),
        set: async (values) => Object.assign(storage, values),
      },
    },
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
    tabs: {
      query: async ({ url }) => tabs.filter((tab) => url.includes(tab.pattern)),
    },
    scripting: {
      getRegisteredContentScripts: async () => currentScripts,
      executeScript: async ({ target, func, files }) => {
        if (func) return [{ result: loadedTabIds.includes(target.tabId) }];
        calls.injected.push({ tabId: target.tabId, files });
        return [{ result: undefined }];
      },
      registerContentScripts: async (scripts) => {
        calls.register.push(...scripts);
        if (failWrites) throw new Error("Duplicate script ID");
        currentScripts = currentScripts.concat(scripts);
      },
      updateContentScripts: async (scripts) => {
        calls.update.push(...scripts);
        if (failWrites) throw new Error("Duplicate script ID");
      },
      unregisterContentScripts: async ({ ids }) => {
        calls.unregister.push(...ids);
        if (failWrites) throw new Error("Nonexistent script ID");
        currentScripts = currentScripts.filter((script) => !ids.includes(script.id));
      },
    },
  };

  return {
    calls,
    storage,
    getRules: () => currentRules,
    setScripts: (scripts) => {
      currentScripts = scripts;
    },
  };
}

function toRuleRegex(pattern) {
  return "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
}

function requiredRegexes(SITE_CONFIGS) {
  return SITE_CONFIGS.filter((c) => !c.optional).flatMap((c) => c.matchPatterns.map(toRuleRegex));
}

function optionalRegexes(SITE_CONFIGS) {
  return SITE_CONFIGS.filter((c) => c.optional).flatMap((c) => c.matchPatterns.map(toRuleRegex));
}

test("古いルールは固定 ID のルールに置き換えられる", async () => {
  const { calls } = createChrome({
    rules: [{ id: "legacy", conditions: [{ pageUrl: { urlMatches: "^https://chatgpt\\.com/.*$" } }] }],
  });
  const { ensureActionRules, SITE_CONFIGS } = await loadSiteSync();

  await ensureActionRules();

  assert.equal(calls.removeRules, 1);
  assert.deepEqual(calls.addRules.map((rule) => rule.id), ["supported-sites", "ungranted-sites"]);

  const supported = calls.addRules[0].conditions.map((condition) => condition.pageUrl.urlMatches);
  assert.deepEqual(supported.slice().sort(), requiredRegexes(SITE_CONFIGS).slice().sort());
});

test("未許可の opt-in サイトは別ルールに分ける", async () => {
  const { calls } = createChrome({ rules: [] });
  const { ensureActionRules, SITE_CONFIGS } = await loadSiteSync();

  await ensureActionRules();

  const ungranted = calls.addRules[1].conditions.map((condition) => condition.pageUrl.urlMatches);
  assert.deepEqual(ungranted.slice().sort(), optionalRegexes(SITE_CONFIGS).slice().sort());
});

test("すべて許可済みなら未許可用のルールを作らない", async () => {
  const { ensureActionRules, SITE_CONFIGS } = await loadSiteSync();
  const { calls } = createChrome({
    rules: [],
    granted: SITE_CONFIGS.filter((c) => c.optional).flatMap((c) => c.matchPatterns),
  });

  await ensureActionRules();

  assert.deepEqual(calls.addRules.map((rule) => rule.id), ["supported-sites"]);
  const supported = calls.addRules[0].conditions.map((condition) => condition.pageUrl.urlMatches);
  assert.equal(supported.length, SITE_CONFIGS.flatMap((c) => c.matchPatterns).length);
});

test("ルールが最新なら書き換えない", async () => {
  const { ensureActionRules, SITE_CONFIGS } = await loadSiteSync();
  const toConditions = (regexes) => regexes.map((urlMatches) => ({ pageUrl: { urlMatches } }));
  const { calls } = createChrome({
    rules: [
      { id: "supported-sites", conditions: toConditions(requiredRegexes(SITE_CONFIGS)) },
      { id: "ungranted-sites", conditions: toConditions(optionalRegexes(SITE_CONFIGS)) },
    ],
  });

  await ensureActionRules();

  assert.equal(calls.removeRules, 0);
  assert.equal(calls.addRules.length, 0);
});

test("同時に呼ばれてもルールは重複しない", async () => {
  const { getRules } = createChrome({ rules: [{ id: "legacy", conditions: [] }] });
  const { ensureActionRules } = await loadSiteSync();

  await Promise.all([ensureActionRules(), ensureActionRules(), ensureActionRules()]);

  assert.deepEqual(getRules().map((rule) => rule.id), ["supported-sites", "ungranted-sites"]);
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

test("新しい世代が書いたルールを古いコードは上書きしない", async () => {
  const { ensureActionRules, SITE_CONFIGS_REVISION } = await loadSiteSync();
  const { calls, getRules } = createChrome({
    rules: [{ id: "supported-sites", conditions: [{ pageUrl: { urlMatches: "^https://newer\\.example/.*$" } }] }],
    storage: { actionRulesRevision: SITE_CONFIGS_REVISION + 1 },
  });

  await ensureActionRules();

  assert.equal(calls.removeRules, 0);
  assert.equal(calls.addRules.length, 0);
  assert.equal(getRules()[0].conditions[0].pageUrl.urlMatches, "^https://newer\\.example/.*$");
});

test("ルールを書いたら世代番号を記録する", async () => {
  const { ensureActionRules, SITE_CONFIGS_REVISION } = await loadSiteSync();
  const { storage } = createChrome({ rules: [{ id: "legacy", conditions: [] }] });

  await ensureActionRules();

  assert.equal(storage.actionRulesRevision, SITE_CONFIGS_REVISION);
});

test("他コンテキストが先に登録していれば失敗扱いにしない", async () => {
  const { syncOptionalContentScripts, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const winner = {
    id: target.hostname,
    matches: target.matchPatterns,
    js: contentScriptFiles,
    runAt: "document_start",
  };
  const { setScripts } = createChrome({ granted: target.matchPatterns, failWrites: true });
  // The winning context registers between our read and our write
  globalThis.chrome.scripting.registerContentScripts = async () => {
    setScripts([winner]);
    throw new Error("Duplicate script ID");
  };

  await assert.doesNotReject(() => syncOptionalContentScripts());
});

test("登録に失敗し状態も直っていなければ例外にする", async () => {
  const { syncOptionalContentScripts, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  createChrome({ granted: target.matchPatterns, failWrites: true });

  await assert.rejects(() => syncOptionalContentScripts(), /Duplicate script ID/);
});

test("開いているタブにはリロードなしでハンドラを注入する", async () => {
  const { injectIntoOpenTabs, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const { calls } = createChrome({ tabs: [{ id: 7, pattern: target.matchPatterns[0] }] });

  await injectIntoOpenTabs([target]);

  assert.deepEqual(calls.injected, [
    { tabId: 7, files: ["content/ctrl-enter-utils.js", "content/ctrl-enter-handler.js"] },
  ]);
});

test("すでにハンドラが動いているタブには注入しない", async () => {
  const { injectIntoOpenTabs, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const { calls } = createChrome({ tabs: [{ id: 7, pattern: target.matchPatterns[0] }], loadedTabIds: [7] });

  await injectIntoOpenTabs([target]);

  assert.equal(calls.injected.length, 0);
});

test("一部のタブで失敗しても残りには注入する", async () => {
  const { injectIntoOpenTabs, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const { calls } = createChrome({
    tabs: [
      { id: 1, pattern: target.matchPatterns[0] },
      { id: 2, pattern: target.matchPatterns[0] },
    ],
  });
  const executeScript = globalThis.chrome.scripting.executeScript;
  globalThis.chrome.scripting.executeScript = async (options) => {
    if (options.files && options.target.tabId === 1) throw new Error("No tab with id 1");
    return executeScript(options);
  };

  await injectIntoOpenTabs([target]);

  assert.deepEqual(calls.injected.map((call) => call.tabId), [2]);
});
