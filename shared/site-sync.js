/**
 * Site registration sync — shared by the service worker and the extension pages.
 *
 * Chrome keeps serving the previous service worker script after an extension
 * update because the script URL is unchanged, so a service worker that was
 * started before the update keeps an outdated SITE_CONFIGS in memory. Any site
 * added by the update would then never get an action rule or a content script.
 * Extension pages always load the current code, so the popup and the options
 * page run this sync too and repair the state on their next open.
 *
 * Both functions are idempotent and safe to call from any extension context.
 */
import { SITE_CONFIGS, OPTIONAL_SITE_CONFIGS } from "../constants/site-configs.js";

function matchPatternToRegex(pattern) {
  return "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
}

const ACTION_RULE_REGEXES = SITE_CONFIGS.flatMap((config) => config.matchPatterns.map(matchPatternToRegex));

function getActionRules() {
  return new Promise((resolve) => chrome.declarativeContent.onPageChanged.getRules(resolve));
}

// The action is disabled by default and shown declaratively on supported sites.
// declarativeContent needs no host access, so the icon stays clickable on
// optional sites even before the user grants the host permission (the popup is
// where they grant it).
export async function ensureActionRules() {
  const rules = await getActionRules();
  const current = rules.flatMap((rule) => rule.conditions.map((c) => c.pageUrl?.urlMatches));
  const upToDate =
    current.length === ACTION_RULE_REGEXES.length &&
    ACTION_RULE_REGEXES.every((regex) => current.includes(regex));
  if (upToDate) return;

  await new Promise((resolve) =>
    chrome.declarativeContent.onPageChanged.removeRules(undefined, () =>
      chrome.declarativeContent.onPageChanged.addRules(
        [
          {
            conditions: ACTION_RULE_REGEXES.map(
              (regex) => new chrome.declarativeContent.PageStateMatcher({ pageUrl: { urlMatches: regex } })
            ),
            actions: [new chrome.declarativeContent.ShowAction()],
          },
        ],
        resolve
      )
    )
  );
}

// Optional sites are not in manifest content_scripts; their scripts are
// registered here once the user grants the host permission (see popup).
let _syncQueue = Promise.resolve();
export function syncOptionalContentScripts() {
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

export async function syncSiteRegistrations() {
  await Promise.all([ensureActionRules(), syncOptionalContentScripts()]);
}
