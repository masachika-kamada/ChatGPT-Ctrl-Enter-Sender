/**
 * Central site configuration — single source of truth for all supported sites.
 *
 * When adding a new site:
 *   1. Add an entry here (hostname + matchPatterns)
 *   2. Add behavior in content/ctrl-enter-handler.js
 *   3. Add match patterns to manifest.json content_scripts and host_permissions
 *   4. Run `python tools/check_supported_sites.py` to verify consistency
 */
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
  { hostname: "cursor.com", matchPatterns: ["https://cursor.com/agents*", "https://cursor.com/*/agents*"] },
  { hostname: "ai.rakuten.co.jp", matchPatterns: ["https://ai.rakuten.co.jp/*"] },
];

export const SUPPORTED_SITES = SITE_CONFIGS.map((c) => c.hostname);

export function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
}
