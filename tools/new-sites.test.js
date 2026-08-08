const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.join(__dirname, "..", "shared", "new-sites.js");
const siteConfigsPath = path.join(__dirname, "..", "constants", "site-configs.js");

// The extension ships ES modules but package.json declares commonjs, so the
// sources are imported as data URLs, which are always treated as modules
function toDataUrl(source) {
  return "data:text/javascript;base64," + Buffer.from(source, "utf8").toString("base64");
}

async function loadNewSites() {
  const configsUrl = toDataUrl(fs.readFileSync(siteConfigsPath, "utf8"));
  const source = fs
    .readFileSync(modulePath, "utf8")
    .replace("../constants/site-configs.js", configsUrl)
    .concat(`\n// ${Math.random()}\n`);
  const [newSites, configs] = await Promise.all([import(toDataUrl(source)), import(configsUrl)]);
  return { ...newSites, ...configs };
}

function createChrome({ announced, granted = [] } = {}) {
  const storage = announced ? { announcedOptionalSites: announced } : {};
  const openedTabs = [];

  globalThis.chrome = {
    runtime: { getURL: (file) => `chrome-extension://test/${file}` },
    storage: {
      local: {
        get: async (key) => (key in storage ? { [key]: storage[key] } : {}),
        set: async (values) => Object.assign(storage, values),
      },
    },
    permissions: {
      contains: async ({ origins }) => origins.every((origin) => granted.includes(origin)),
    },
    tabs: {
      create: async ({ url }) => openedTabs.push(url),
    },
  };

  return { storage, openedTabs };
}

test("初回はオプションページを開く", async () => {
  const { announceNewSites } = await loadNewSites();
  const { openedTabs } = createChrome();

  assert.equal(await announceNewSites(), true);
  assert.deepEqual(openedTabs, ["chrome-extension://test/options/options.html"]);
});

test("初回に現在の opt-in サイトを記録する", async () => {
  const { announceNewSites, OPTIONAL_SITE_CONFIGS } = await loadNewSites();
  const { storage } = createChrome();

  await announceNewSites();

  assert.deepEqual(
    storage.announcedOptionalSites,
    OPTIONAL_SITE_CONFIGS.map((config) => config.hostname)
  );
});

test("一度開いたら二度と開かない", async () => {
  const { announceNewSites } = await loadNewSites();
  const { openedTabs } = createChrome();

  await announceNewSites();
  assert.equal(await announceNewSites(), false);
  assert.equal(openedTabs.length, 1);
});

test("サイトが追加されても更新時には開かない", async () => {
  const { announceNewSites, OPTIONAL_SITE_CONFIGS } = await loadNewSites();
  const older = OPTIONAL_SITE_CONFIGS.slice(0, -1).map((config) => config.hostname);
  const { openedTabs } = createChrome({ announced: older });

  assert.equal(await announceNewSites(), false);
  assert.equal(openedTabs.length, 0);
});
