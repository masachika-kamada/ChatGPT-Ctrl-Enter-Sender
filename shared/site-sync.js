/**
 * Site registration sync — shared by the service worker and the extension pages.
 *
 * An extension update can leave a service worker that was started before the
 * update running pre-update code, because its script URL is unchanged. Such a
 * worker holds an outdated SITE_CONFIGS, so any site added by the update gets
 * neither an action rule nor a content script. Reproduced with unpacked
 * updates; whether packed store updates hit the same path is unverified, so
 * this module is written to repair the state either way.
 *
 * Extension pages always load current code, so the popup and the options page
 * run this sync too. Every export is idempotent and safe to call concurrently
 * from any extension context.
 */
import { SITE_CONFIGS, SITE_CONFIGS_REVISION, OPTIONAL_SITE_CONFIGS } from "../constants/site-configs.js";

const ACTION_RULE_ID = "supported-sites";
const RULES_REVISION_KEY = "actionRulesRevision";
const CONTENT_SCRIPT_FILES = ["content/ctrl-enter-utils.js", "content/ctrl-enter-handler.js"];
const RUN_AT = "document_start";

function matchPatternToRegex(pattern) {
  return "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
}

const ACTION_RULE_REGEXES = SITE_CONFIGS.flatMap((config) => config.matchPatterns.map(matchPatternToRegex));

function sameMembers(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value) => b.includes(value));
}

// Callback APIs report failures through lastError instead of rejecting
function callWithLastError(invoke) {
  return new Promise((resolve, reject) =>
    invoke(() => (chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve()))
  );
}

function getActionRules() {
  return new Promise((resolve) => chrome.declarativeContent.onPageChanged.getRules(resolve));
}

// ── Action icon visibility ───────────────────────────────────────────────────
// The action is disabled by default and shown declaratively on supported sites.
// declarativeContent needs no host access, so the icon stays clickable on
// optional sites even before the user grants the host permission (the popup is
// where they grant it).

let _rulesQueue = Promise.resolve();

export function ensureActionRules() {
  const result = _rulesQueue.then(_doEnsureActionRules, _doEnsureActionRules);
  // A rejected sync must not poison the next caller's queue
  _rulesQueue = result.catch(() => { });
  return result;
}

async function _doEnsureActionRules() {
  const rules = await getActionRules();
  const current = rules.flatMap((rule) => rule.conditions.map((c) => c.pageUrl?.urlMatches));
  const upToDate = rules.length === 1 && rules[0].id === ACTION_RULE_ID && sameMembers(current, ACTION_RULE_REGEXES);
  if (upToDate) return;

  // A worker still running pre-update code would otherwise overwrite the rules
  // an extension page already repaired with the current site list
  const stored = await chrome.storage.local.get(RULES_REVISION_KEY);
  if ((stored[RULES_REVISION_KEY] ?? 0) > SITE_CONFIGS_REVISION) return;

  // Clears both the outdated rule and the unnamed rules older versions added
  await callWithLastError((done) => chrome.declarativeContent.onPageChanged.removeRules(undefined, done));
  try {
    await callWithLastError((done) =>
      chrome.declarativeContent.onPageChanged.addRules(
        [
          {
            id: ACTION_RULE_ID,
            conditions: ACTION_RULE_REGEXES.map(
              (regex) => new chrome.declarativeContent.PageStateMatcher({ pageUrl: { urlMatches: regex } })
            ),
            actions: [new chrome.declarativeContent.ShowAction()],
          },
        ],
        done
      )
    );
  } catch (error) {
    // Tolerate another context winning the race with the same rule id
    const rulesNow = await getActionRules();
    if (!rulesNow.some((rule) => rule.id === ACTION_RULE_ID)) throw error;
    return;
  }

  await chrome.storage.local.set({ [RULES_REVISION_KEY]: SITE_CONFIGS_REVISION });
}

// ── Dynamic content scripts for optional sites ───────────────────────────────
// Optional sites are not in manifest content_scripts; their scripts are
// registered here once the user grants the host permission (see popup).

let _scriptsQueue = Promise.resolve();

export function syncOptionalContentScripts() {
  const result = _scriptsQueue.then(_doSyncOptionalContentScripts, _doSyncOptionalContentScripts);
  _scriptsQueue = result.catch(() => { });
  return result;
}

function isRegistrationCurrent(existing, script) {
  return (
    Boolean(existing) &&
    sameMembers(existing.matches, script.matches) &&
    sameMembers(existing.js, script.js) &&
    existing.runAt === script.runAt
  );
}

// The popup and the service worker both sync on a permission grant, and their
// queues are per-context, so a losing writer must accept the winner's result
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
    const findSelf = (scripts) => scripts.find((s) => s.id === config.hostname);

    if (granted && !isRegistrationCurrent(existing, script)) {
      // updateContentScripts keeps a site working after its patterns change
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

export async function syncSiteRegistrations() {
  await Promise.all([ensureActionRules(), syncOptionalContentScripts()]);
}

// A content script only reaches tabs loaded after it was registered, so tabs
// that are already open would need a reload before the extension does anything
export async function injectIntoOpenTabs(configs) {
  for (const config of configs) {
    let tabs = [];
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
        // The tab was closed, or is a page extensions cannot run in
      }
    }
  }
}
