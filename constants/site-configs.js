/**
 * Central site configuration — single source of truth for all supported sites.
 *
 * Sites come in two kinds:
 *   - Required sites: listed in manifest.json content_scripts / host_permissions.
 *     Adding one triggers a permission re-approval that disables the extension
 *     for every user until they re-enable it. Do NOT add new required sites.
 *   - Optional sites (`optional: true`): covered by optional_host_permissions.
 *     The user grants access per-site from the popup; content scripts are
 *     registered dynamically by shared/site-sync.js. Adding one never disables
 *     the extension for existing users.
 *
 * When adding a new site:
 *   1. Add an entry here with `optional: true` (hostname + matchPatterns)
 *   2. Bump SITE_CONFIGS_REVISION so a leftover service worker cannot revert it
 *   3. Add behavior in content/ctrl-enter-handler.js
 *   4. Add the match patterns to optional_host_permissions in manifest.json
 *   5. Run `python tools/check_supported_sites.py` to verify consistency
 */

// Generation marker for the site list. shared/site-sync.js records the highest
// revision that wrote the action rules, so a service worker left running
// pre-update code cannot overwrite a newer sync with its outdated list.
export const SITE_CONFIGS_REVISION = 1;

export const SITE_CONFIGS = [
  { hostname: "chatgpt.com", matchPatterns: ["https://chatgpt.com/*"] },
  { hostname: "claude.ai", matchPatterns: ["https://claude.ai/*"] },
  { hostname: "gemini.google.com", matchPatterns: ["https://gemini.google.com/*"] },
  { hostname: "copilot.microsoft.com", matchPatterns: ["https://copilot.microsoft.com/*"] },
  { hostname: "m365.cloud.microsoft", matchPatterns: ["https://m365.cloud.microsoft/*"] },
  { hostname: "chat.deepseek.com", matchPatterns: ["https://chat.deepseek.com/*"] },
  { hostname: "grok.com", matchPatterns: ["https://grok.com/*"] },
  { hostname: "www.perplexity.ai", matchPatterns: ["https://www.perplexity.ai/*"] },
  { hostname: "chat.mistral.ai", matchPatterns: ["https://chat.mistral.ai/*"] },
  { hostname: "notebooklm.google.com", matchPatterns: ["https://notebooklm.google.com/*"] },
  { hostname: "github.com", matchPatterns: ["https://github.com/copilot*", "https://github.com/spark*"] },
  { hostname: "poe.com", matchPatterns: ["https://poe.com/*"] },
  { hostname: "v0.app", matchPatterns: ["https://v0.app/*"] },
  { hostname: "cursor.com", matchPatterns: ["https://cursor.com/agents*", "https://cursor.com/*/agents*"], optional: true },
  { hostname: "www.genspark.ai", matchPatterns: ["https://www.genspark.ai/*"], optional: true },
  { hostname: "duck.ai", matchPatterns: ["https://duck.ai/*"], optional: true },
  { hostname: "manus.im", matchPatterns: ["https://manus.im/*"], optional: true },
  { hostname: "www.kimi.com", matchPatterns: ["https://www.kimi.com/*"], optional: true },
];

export const OPTIONAL_SITE_CONFIGS = SITE_CONFIGS.filter((c) => c.optional);

export const SUPPORTED_SITES = SITE_CONFIGS.map((c) => c.hostname);

export function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
}
