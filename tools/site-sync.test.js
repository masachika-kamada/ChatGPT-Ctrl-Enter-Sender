const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const siteSyncPath = path.join(__dirname, "..", "shared", "site-sync.js");
const siteConfigsPath = path.join(__dirname, "..", "constants", "site-configs.js");
const contentScriptFiles = ["content/ctrl-enter-utils.js", "content/ctrl-enter-handler.js"];

function toDataUrl(source) {
  return "data:text/javascript;base64," + Buffer.from(source, "utf8").toString("base64");
}

async function loadSiteSync() {
  const configsUrl = toDataUrl(fs.readFileSync(siteConfigsPath, "utf8"));
  const source = fs.readFileSync(siteSyncPath, "utf8")
    .replace("../constants/site-configs.js", configsUrl)
    .concat(`\n// ${Math.random()}\n`);
  const [siteSync, configs] = await Promise.all([import(toDataUrl(source)), import(configsUrl)]);
  return { ...siteSync, ...configs };
}

function createChrome({ registered = [], granted = [], tabs = [], loadedTabIds = [] } = {}) {
  const calls = { register: [], update: [], unregister: [], injected: [] };
  let currentScripts = registered;

  globalThis.chrome = {
    permissions: {
      contains: async ({ origins }) => origins.every((origin) => granted.includes(origin)),
    },
    tabs: {
      query: async ({ url }) => tabs.filter((tab) => url.some((pattern) => tab.url.startsWith(pattern.replace("*", "")))),
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
        currentScripts = currentScripts.concat(scripts);
      },
      updateContentScripts: async (scripts) => {
        calls.update.push(...scripts);
        currentScripts = currentScripts.filter((script) => script.id !== scripts[0].id).concat(scripts);
      },
      unregisterContentScripts: async ({ ids }) => {
        calls.unregister.push(...ids);
        currentScripts = currentScripts.filter((script) => !ids.includes(script.id));
      },
    },
  };

  return { calls, getScripts: () => currentScripts };
}

test("a granted opt-in site registers its content script", async () => {
  const { syncOptionalContentScripts, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const { calls } = createChrome({ granted: target.matchPatterns });

  await syncOptionalContentScripts();

  assert.deepEqual(calls.register.map((script) => script.id), [target.hostname]);
  assert.deepEqual(calls.register[0].matches, target.matchPatterns);
  assert.deepEqual(calls.register[0].js, contentScriptFiles);
  assert.equal(calls.register[0].runAt, "document_start");
});

test("an existing registration is updated when its match patterns change", async () => {
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

test("revoked opt-in access unregisters its content script", async () => {
  const { syncOptionalContentScripts, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const { calls, getScripts } = createChrome({
    registered: [
      { id: target.hostname, matches: target.matchPatterns, js: contentScriptFiles, runAt: "document_start" },
    ],
  });

  await syncOptionalContentScripts();

  assert.deepEqual(calls.unregister, [target.hostname]);
  assert.deepEqual(getScripts(), []);
});

test("concurrent sync calls register each granted site once", async () => {
  const { syncOptionalContentScripts, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const { calls, getScripts } = createChrome({ granted: target.matchPatterns });

  await Promise.all([syncOptionalContentScripts(), syncOptionalContentScripts(), syncOptionalContentScripts()]);

  assert.equal(calls.register.length, 1);
  assert.equal(getScripts().length, 1);
});

test("open tabs are injected only when the handler is not already loaded", async () => {
  const { injectIntoOpenTabs, OPTIONAL_SITE_CONFIGS } = await loadSiteSync();
  const target = OPTIONAL_SITE_CONFIGS.at(-1);
  const { calls } = createChrome({
    granted: target.matchPatterns,
    tabs: [{ id: 1, url: target.matchPatterns[0].replace("*", "chat") }, { id: 2, url: target.matchPatterns[0].replace("*", "other") }],
    loadedTabIds: [1],
  });

  await injectIntoOpenTabs([target]);

  assert.deepEqual(calls.injected, [{ tabId: 2, files: contentScriptFiles }]);
});
