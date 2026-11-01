/**
 * Synchronizes optional-site content scripts and handles tabs that were open
 * when a permission was granted. Firefox does not implement declarativeContent,
 * so the toolbar action is managed by the background script instead.
 */
import { OPTIONAL_SITE_CONFIGS } from "../constants/site-configs.js";

const CONTENT_SCRIPT_FILES = ["content/ctrl-enter-utils.js", "content/ctrl-enter-handler.js"];
const RUN_AT = "document_start";

function sameMembers(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value) => b.includes(value));
}

function isRegistrationCurrent(existing, script) {
  return Boolean(existing) &&
    sameMembers(existing.matches, script.matches) &&
    sameMembers(existing.js, script.js) &&
    existing.runAt === script.runAt;
}

let _scriptsQueue = Promise.resolve();

export function syncOptionalContentScripts() {
  const result = _scriptsQueue.then(_doSyncOptionalContentScripts, _doSyncOptionalContentScripts);
  _scriptsQueue = result.catch(() => {});
  return result;
}

async function tolerateConcurrentWrite(write, isSettled) {
  try {
    await write();
  } catch (error) {
    const registered = await chrome.scripting.getRegisteredContentScripts();
    if (!isSettled(registered)) throw error;
  }
}

async function _doSyncOptionalContentScripts() {
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const byId = new Map(registered.map((script) => [script.id, script]));

  for (const config of OPTIONAL_SITE_CONFIGS) {
    const granted = await chrome.permissions.contains({ origins: config.matchPatterns });
    const existing = byId.get(config.hostname);
    const script = {
      id: config.hostname,
      matches: config.matchPatterns,
      js: CONTENT_SCRIPT_FILES,
      runAt: RUN_AT,
    };
    const findSelf = (scripts) => scripts.find((item) => item.id === config.hostname);

    if (granted && !isRegistrationCurrent(existing, script)) {
      const write = existing
        ? () => chrome.scripting.updateContentScripts([script])
        : () => chrome.scripting.registerContentScripts([script]);
      await tolerateConcurrentWrite(write, (scripts) => isRegistrationCurrent(findSelf(scripts), script));
    } else if (!granted && existing) {
      await tolerateConcurrentWrite(
        () => chrome.scripting.unregisterContentScripts({ ids: [config.hostname] }),
        (scripts) => !findSelf(scripts)
      );
    }
  }
}

export function syncSiteRegistrations() {
  return syncOptionalContentScripts();
}

export async function injectIntoOpenTabs(configs) {
  for (const config of configs) {
    let tabs;
    try {
      tabs = await chrome.tabs.query({ url: config.matchPatterns });
    } catch (error) {
      continue;
    }

    for (const tab of tabs) {
      try {
        const [probe] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => Boolean(window.__ctrlEnterSenderLoaded),
        });
        if (probe?.result) continue;

        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_SCRIPT_FILES });
      } catch (error) {
        // The tab may have closed or may be a browser-protected page.
      }
    }
  }
}
