const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serviceWorkerPath = path.join(__dirname, "..", "service-worker.js");

function toDataUrl(source) {
  return "data:text/javascript;base64," + Buffer.from(source, "utf8").toString("base64");
}

async function loadServiceWorker(deps) {
  const listeners = {};
  const events = [];
  globalThis.__serviceWorkerDeps = deps;
  globalThis.chrome = {
    action: {
      enable: async () => events.push("enable"),
      setIcon: async () => events.push("icon"),
    },
    permissions: {
      onAdded: { addListener: (listener) => { listeners.onAdded = listener; } },
      onRemoved: { addListener: (listener) => { listeners.onRemoved = listener; } },
    },
    runtime: {
      id: "test-extension",
      onInstalled: { addListener: (listener) => { listeners.onInstalled = listener; } },
      onMessage: { addListener: (listener) => { listeners.onMessage = listener; } },
      onStartup: { addListener: (listener) => { listeners.onStartup = listener; } },
    },
    storage: {
      sync: {
        get: async () => ({}),
        set: async () => {},
      },
    },
    tabs: {
      get: async () => ({ id: 7, url: "https://duck.ai/" }),
      onActivated: { addListener: (listener) => { listeners.onActivated = listener; } },
      onUpdated: { addListener: (listener) => { listeners.onUpdated = listener; } },
      query: async () => [{ id: 7, url: "https://duck.ai/" }],
    },
  };

  const configsUrl = toDataUrl(`
    export const SITE_CONFIGS = [{ hostname: "duck.ai", matchPatterns: ["https://duck.ai/*"], optional: true }];
    export const SUPPORTED_SITES = ["duck.ai"];
    export const extractHostname = (url) => new URL(url).hostname;
  `);
  const siteSyncUrl = toDataUrl(`
    export const syncOptionalContentScripts = (...args) => globalThis.__serviceWorkerDeps.syncOptionalContentScripts(...args);
    export const injectIntoOpenTabs = (...args) => globalThis.__serviceWorkerDeps.injectIntoOpenTabs(...args);
  `);
  const newSitesUrl = toDataUrl(`
    export const announceNewSites = (...args) => globalThis.__serviceWorkerDeps.announceNewSites(...args);
  `);
  const source = fs.readFileSync(serviceWorkerPath, "utf8")
    .replace("./constants/site-configs.js", configsUrl)
    .replace("./shared/site-sync.js", siteSyncUrl)
    .replace("./shared/new-sites.js", newSitesUrl)
    .concat(`\n// ${Math.random()}\n`);

  await import(toDataUrl(source));
  return { events, listeners };
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("newly granted site scripts are synchronized before existing tabs are injected", async () => {
  const deps = {
    syncOptionalContentScripts: async () => {},
    injectIntoOpenTabs: async () => {},
    announceNewSites: async () => {},
  };
  const { events, listeners } = await loadServiceWorker(deps);

  let finishSync;
  deps.syncOptionalContentScripts = () => new Promise((resolve) => {
    finishSync = () => {
      events.push("scripts");
      resolve();
    };
  });
  deps.injectIntoOpenTabs = async () => events.push("inject");

  listeners.onAdded({ origins: ["https://duck.ai/*"] });
  await flushPromises();
  assert.deepEqual(events, []);

  finishSync();
  await flushPromises();
  await flushPromises();
  assert.deepEqual(events, ["scripts", "inject", "icon", "enable"]);
});
