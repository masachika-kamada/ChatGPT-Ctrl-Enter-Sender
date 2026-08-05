/**
 * Opt-in site discovery.
 *
 * An opt-in site is invisible until the user opens the popup while on it,
 * which they have no reason to do without knowing the site is supported.
 * Detecting that visit would need the "tabs" permission, which adds a
 * browsing-history warning and would disable the extension for every existing
 * user, so the options page is the only place the sites can be introduced.
 *
 * This runs on service worker start rather than from onInstalled, because a
 * worker left running pre-update code can miss that event entirely.
 */
import { OPTIONAL_SITE_CONFIGS } from "../constants/site-configs.js";

const ANNOUNCED_KEY = "announcedOptionalSites";

export async function getUnannouncedSites() {
  const stored = await chrome.storage.local.get(ANNOUNCED_KEY);
  const announced = new Set(stored[ANNOUNCED_KEY] ?? []);
  const sites = [];

  for (const config of OPTIONAL_SITE_CONFIGS) {
    if (announced.has(config.hostname)) continue;
    // Already granted means the user found the site without being told
    if (await chrome.permissions.contains({ origins: config.matchPatterns })) continue;
    sites.push(config.hostname);
  }

  return sites;
}

export function markNewSitesSeen() {
  return chrome.storage.local.set({
    [ANNOUNCED_KEY]: OPTIONAL_SITE_CONFIGS.map((config) => config.hostname),
  });
}

export async function announceNewSites() {
  const unannounced = await getUnannouncedSites();
  if (unannounced.length === 0) return false;

  // Marking first keeps a failed tab from reopening on every worker start
  await markNewSitesSeen();
  await chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html") });
  return true;
}
