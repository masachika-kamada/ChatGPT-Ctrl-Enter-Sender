import { SUPPORTED_SITES, SITE_CONFIGS, extractHostname } from "./constants/site-configs.js";
import { ensureActionRules, syncOptionalContentScripts, injectIntoOpenTabs } from "./shared/site-sync.js";
import { announceNewSites } from "./shared/new-sites.js";

// ── Serialized site-setting updates ─────────────────────────────────────────

let _settingsQueue = Promise.resolve();
function updateSiteSettings(updates) {
  const applyUpdates = async () => {
    const { siteSettings = {} } = await chrome.storage.sync.get("siteSettings");
    await chrome.storage.sync.set({ siteSettings: { ...siteSettings, ...updates } });
  };
  _settingsQueue = _settingsQueue.then(applyUpdates, applyUpdates);
  return _settingsQueue;
}

function validateSiteSettingUpdates(updates) {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) return null;

  const entries = Object.entries(updates);
  if (entries.length === 0) return null;
  if (entries.some(([hostname, enabled]) =>
    !SUPPORTED_SITES.includes(hostname) || typeof enabled !== "boolean")) {
    return null;
  }

  return Object.fromEntries(entries);
}

// Both operations are idempotent, so run them on every service worker start
// rather than relying on onInstalled/onStartup (which don't cover all the
// ways rules and registrations can get out of sync, e.g. unpacked loads).
chrome.action.disable();
ensureActionRules();
syncOptionalContentScripts();
announceNewSites();

chrome.runtime.onInstalled.addListener((details) => {
  // Tabs opened before the install would otherwise need a reload
  if (details.reason === "install") {
    injectIntoOpenTabs(SITE_CONFIGS.filter((config) => !config.optional));
  }
});

// Session-restored tabs can finish loading before the extension is ready, and
// they then run without a content script until the user reloads them
chrome.runtime.onStartup.addListener(() => injectIntoOpenTabs(SITE_CONFIGS));

// Covers grants/revocations from the popup, the options page, and the
// site-access controls in chrome://extensions.
chrome.permissions.onAdded.addListener((permissions) => {
  const origins = permissions.origins ?? [];
  const granted = SITE_CONFIGS.filter((config) => config.matchPatterns.some((p) => origins.includes(p)));
  // Wait until the ungranted icon rule is gone before painting the tab icon
  Promise.allSettled([ensureActionRules(), syncOptionalContentScripts()])
    .then(() => injectIntoOpenTabs(granted))
    .then(() => refreshActionIcons(granted))
    .catch(() => { });
});
chrome.permissions.onRemoved.addListener(() => {
  Promise.allSettled([ensureActionRules(), syncOptionalContentScripts()]);
});

// Lets the popup/options page keep working when they are not the ones syncing.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message?.type === "update-site-settings") {
    const updates = validateSiteSettingUpdates(message.updates);
    if (!updates) {
      sendResponse({ ok: false, error: "Invalid site setting update" });
      return;
    }

    updateSiteSettings(updates).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: String(error) })
    );
    return true;
  }
});

// ── Per-tab icon state on supported sites ────────────────────────────────────

async function applyActionIcon(tabId, url) {
  // url is unavailable on sites we have no host permission for (e.g. optional
  // sites not yet granted); leave those to declarativeContent
  if (!url) return;

  const hostname = extractHostname(url);
  const config = SITE_CONFIGS.find((c) => c.hostname === hostname);
  if (!config) {
    await chrome.action.disable(tabId);
    return;
  }

  const { siteSettings = {} } = await chrome.storage.sync.get("siteSettings");
  const isEnabled = siteSettings[hostname] ?? true;
  await chrome.action.setIcon({ tabId, path: isEnabled ? "icon/enabled.png" : "icon/disabled.png" });
  await chrome.action.enable(tabId);
}

async function refreshActionIcons(configs) {
  for (const config of configs) {
    let tabs = [];
    try {
      tabs = await chrome.tabs.query({ url: config.matchPatterns });
    } catch (error) {
      continue;
    }
    for (const tab of tabs) {
      await applyActionIcon(tab.id, tab.url).catch(() => { });
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" && !changeInfo.url) return;
  applyActionIcon(tabId, tab.url).catch(() => { });
});

// A navigation clears the tab's icon, and a tab that was discarded, frozen or
// restored while the worker was asleep can come back without one
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs
    .get(tabId)
    .then((tab) => applyActionIcon(tabId, tab.url))
    .catch(() => { });
});
