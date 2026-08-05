import './agent-reload.js';
import { SITE_CONFIGS, OPTIONAL_SITE_CONFIGS, SUPPORTED_SITES, extractHostname } from "./constants/site-configs.js";

// ── Action icon visibility ───────────────────────────────────────────────────
// The action is disabled by default and shown declaratively on supported sites.
// declarativeContent needs no host access, so the icon stays clickable on
// optional sites even before the user grants the host permission (the popup is
// where they grant it).

function matchPatternToRegex(pattern) {
  return "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
}

const ACTION_RULE_REGEXES = SITE_CONFIGS.flatMap((config) => config.matchPatterns.map(matchPatternToRegex));

function getActionRules() {
  return new Promise((resolve) => chrome.declarativeContent.onPageChanged.getRules(resolve));
}

async function ensureActionRules() {
  chrome.action.disable();

  const rules = await getActionRules();
  const current = rules.flatMap((rule) => rule.conditions.map((c) => c.pageUrl?.urlMatches));
  const upToDate =
    current.length === ACTION_RULE_REGEXES.length &&
    ACTION_RULE_REGEXES.every((regex) => current.includes(regex));
  if (upToDate) return;

  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: ACTION_RULE_REGEXES.map(
          (regex) => new chrome.declarativeContent.PageStateMatcher({ pageUrl: { urlMatches: regex } })
        ),
        actions: [new chrome.declarativeContent.ShowAction()],
      },
    ]);
  });
}

// ── Dynamic content scripts for optional sites ───────────────────────────────
// Optional sites are not in manifest content_scripts; their scripts are
// registered here once the user grants the host permission (see popup).

let _syncQueue = Promise.resolve();
function syncOptionalContentScripts() {
  _syncQueue = _syncQueue.then(_doSyncOptionalContentScripts, _doSyncOptionalContentScripts);
  return _syncQueue;
}
async function _doSyncOptionalContentScripts() {
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const registeredIds = new Set(registered.map((script) => script.id));

  for (const config of OPTIONAL_SITE_CONFIGS) {
    const granted = await chrome.permissions.contains({ origins: config.matchPatterns });
    if (granted && !registeredIds.has(config.hostname)) {
      await chrome.scripting.registerContentScripts([
        {
          id: config.hostname,
          matches: config.matchPatterns,
          js: ["content/ctrl-enter-utils.js", "content/ctrl-enter-handler.js"],
          runAt: "document_start",
        },
      ]);
    } else if (!granted && registeredIds.has(config.hostname)) {
      await chrome.scripting.unregisterContentScripts({ ids: [config.hostname] });
    }
  }
}

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
ensureActionRules();
syncOptionalContentScripts();

// Notify user on update (useful for non-host_permissions changes)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "update") {
    chrome.storage.local.set({ updatedFrom: details.previousVersion });
  }
});

// Covers grants/revocations from the popup, the options page, and the
// site-access controls in chrome://extensions.
chrome.permissions.onAdded.addListener(() => syncOptionalContentScripts());
chrome.permissions.onRemoved.addListener(() => syncOptionalContentScripts());

// Lets the popup/options page wait for registration before reloading the tab.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message?.type === "sync-optional-sites") {
    syncOptionalContentScripts().then(() => sendResponse(true));
    return true;
  }

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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // tab.url is unavailable on sites we have no host permission for
  // (e.g. optional sites not yet granted); leave those to declarativeContent
  const url = tab.url;
  if (!url) return;

  const hostname = extractHostname(url);
  if (!SUPPORTED_SITES.includes(hostname)) {
    chrome.action.disable(tabId).catch(() => { });
    return;
  }

  if (changeInfo.status === "complete") {
    chrome.storage.sync.get("siteSettings", (data) => {
      const siteSettings = data.siteSettings || {};
      const isEnabled = siteSettings[hostname] ?? true;

      chrome.action.setIcon({ tabId, path: isEnabled ? "icon/enabled.png" : "icon/disabled.png" }).catch(() => { });
      chrome.action.enable(tabId).catch(() => { });
    });
  }
});
