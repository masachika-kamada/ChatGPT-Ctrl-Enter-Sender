import { SUPPORTED_SITES, extractHostname } from "./constants/site-configs.js";
import { ensureActionRules, syncOptionalContentScripts } from "./shared/site-sync.js";

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
