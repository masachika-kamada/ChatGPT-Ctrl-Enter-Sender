/**
 * First-run introduction to opt-in sites.
 *
 * An opt-in site is invisible until the user opens the popup while on it, and
 * detecting that visit would need the "tabs" permission, which adds a
 * browsing-history warning. So the options page is where those sites get
 * introduced, once.
 *
 * Only on a first run: widely used services are shipped as required sites and
 * work without any setup, so a later update has nothing the user must act on,
 * and opening a tab to say so would be noise.
 *
 * This runs on service worker start rather than from onInstalled, because a
 * worker left running pre-update code can miss that event entirely.
 */
import { OPTIONAL_SITE_CONFIGS } from "../constants/site-configs.js";

const ANNOUNCED_KEY = "announcedOptionalSites";

export function markNewSitesSeen() {
  return chrome.storage.local.set({
    [ANNOUNCED_KEY]: OPTIONAL_SITE_CONFIGS.map((config) => config.hostname),
  });
}

export async function announceNewSites() {
  const stored = await chrome.storage.local.get(ANNOUNCED_KEY);
  if (ANNOUNCED_KEY in stored) return false;

  // Marking first keeps a failed tab from reopening on every worker start
  await markNewSitesSeen();
  await chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html") });
  return true;
}
