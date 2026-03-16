/**
 * Copy cookies/sessions from your real Chrome browser to the test profile.
 *
 * This avoids CAPTCHA issues entirely by:
 *   1. Launching your real Chrome profile (where you're already logged in)
 *   2. Extracting cookies for all supported sites
 *   3. Saving them to a file that the test fixtures can load
 *
 * Usage:
 *   1. Close all Chrome windows
 *   2. node tests/copy-chrome-session.js
 *   3. Run tests: npm test
 *
 * After running this, the test browser will have your login sessions.
 */
const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

const SUPPORTED_DOMAINS = [
  "chatgpt.com",
  "claude.ai",
  "gemini.google.com",
  "accounts.google.com",
  "chat.deepseek.com",
  "poe.com",
  "chat.mistral.ai",
  "notebooklm.google.com",
  "you.com",
  "grok.com",
  "www.perplexity.ai",
  "copilot.microsoft.com",
  "github.com",
];

const COOKIES_FILE = path.join(__dirname, "..", "test-user-data", "cookies.json");

function askUser(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const chromeUserData = path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "User Data");

  if (!fs.existsSync(chromeUserData)) {
    console.error("Chrome User Data not found at:", chromeUserData);
    process.exit(1);
  }

  console.log("\n=== Copy Chrome Session ===");
  console.log("This will copy your login cookies from Chrome to the test profile.\n");
  console.log("⚠️  IMPORTANT: Close ALL Chrome windows first!");
  console.log("   (Playwright can't access a profile Chrome is using)\n");

  await askUser("Press Enter after closing Chrome... ");

  console.log("Launching Chrome with your profile...");

  const context = await chromium.launchPersistentContext(chromeUserData, {
    headless: false,
    args: [
      "--no-first-run",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    viewport: { width: 800, height: 600 },
  });

  // Extract cookies for all supported domains
  const cookies = await context.cookies();

  const relevantCookies = cookies.filter((cookie) => {
    return SUPPORTED_DOMAINS.some((domain) => {
      return cookie.domain.includes(domain) || domain.includes(cookie.domain.replace(/^\./, ""));
    });
  });

  console.log(`\nFound ${cookies.length} total cookies, ${relevantCookies.length} for supported sites.`);

  // Show which sites have cookies
  const sitesWithCookies = new Set();
  for (const cookie of relevantCookies) {
    for (const domain of SUPPORTED_DOMAINS) {
      if (cookie.domain.includes(domain) || domain.includes(cookie.domain.replace(/^\./, ""))) {
        sitesWithCookies.add(domain);
      }
    }
  }

  console.log("\nSites with saved sessions:");
  for (const domain of SUPPORTED_DOMAINS) {
    const has = sitesWithCookies.has(domain);
    console.log(`  ${has ? "✅" : "❌"} ${domain}`);
  }

  // Now visit each supported site briefly to grab any additional cookies
  console.log("\nBriefly visiting each site to capture fresh cookies...");

  for (const domain of SUPPORTED_DOMAINS) {
    try {
      const page = await context.newPage();
      await page.goto(`https://${domain}/`, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForTimeout(2000);
      await page.close();
      process.stdout.write(`  ✅ ${domain}\n`);
    } catch {
      process.stdout.write(`  ⚠️ ${domain} (timeout or error)\n`);
    }
  }

  // Get all cookies again after visiting sites
  const allCookies = await context.cookies();
  const finalCookies = allCookies.filter((cookie) => {
    return SUPPORTED_DOMAINS.some((domain) => {
      return cookie.domain.includes(domain) || domain.includes(cookie.domain.replace(/^\./, ""));
    });
  });

  // Save cookies
  const outputDir = path.dirname(COOKIES_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(finalCookies, null, 2));

  console.log(`\n✅ Saved ${finalCookies.length} cookies to ${COOKIES_FILE}`);

  await context.close();

  console.log("\nDone! Now run tests with: npm test");
  console.log("The test browser will automatically load these cookies.\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
