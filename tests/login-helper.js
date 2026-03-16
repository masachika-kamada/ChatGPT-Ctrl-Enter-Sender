/**
 * Login Helper — Opens sites so you can log in manually.
 * Session data is saved to test-user-data/ and reused in subsequent test runs.
 *
 * Usage:
 *   node tests/login-helper.js                        # All auth-required sites
 *   node tests/login-helper.js ChatGPT                # Specific site only
 *   node tests/login-helper.js Claude Gemini           # Multiple sites
 *   node tests/login-helper.js --use-chrome-profile    # Copy session from your real Chrome
 *
 * The --use-chrome-profile flag launches your real Chrome profile (already logged in),
 * which avoids CAPTCHA/bot-detection issues entirely.
 */
const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

const AUTH_SITES = [
  { name: "ChatGPT", url: "https://chatgpt.com/" },
  { name: "Claude", url: "https://claude.ai/" },
  { name: "Gemini", url: "https://gemini.google.com/app" },
  { name: "DeepSeek", url: "https://chat.deepseek.com/" },
  { name: "Poe", url: "https://poe.com/" },
  { name: "Mistral", url: "https://chat.mistral.ai/chat" },
  { name: "NotebookLM", url: "https://notebooklm.google.com/" },
  { name: "You.com", url: "https://you.com/" },
];

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
  const rawArgs = process.argv.slice(2);
  const useChromeProfile = rawArgs.includes("--use-chrome-profile");
  const args = rawArgs.filter((a) => !a.startsWith("--"));
  const requestedSites = args.length > 0
    ? AUTH_SITES.filter((s) => args.some((a) => s.name.toLowerCase().includes(a.toLowerCase())))
    : AUTH_SITES;

  if (requestedSites.length === 0) {
    console.log("No matching sites found. Available sites:");
    AUTH_SITES.forEach((s) => console.log(`  - ${s.name}`));
    process.exit(1);
  }

  const extensionPath = path.resolve(__dirname, "..");
  let userDataDir;

  if (useChromeProfile) {
    // Use the real Chrome profile — already logged in to most sites
    userDataDir = path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "User Data");
    console.log("\n=== Login Helper (Chrome Profile Mode) ===");
    console.log("⚠️  IMPORTANT: Close all Chrome windows before continuing!");
    console.log("   Playwright cannot use a profile that Chrome is currently using.\n");
    await askUser("Press Enter after closing Chrome... ");
  } else {
    userDataDir = path.join(__dirname, "..", "test-user-data");
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    console.log("\n=== Login Helper ===");
  }

  console.log(`Profile: ${userDataDir}`);
  console.log(`Sites: ${requestedSites.map((s) => s.name).join(", ")}\n`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--disable-gpu",
      // Stealth: avoid bot detection / CAPTCHA loops
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    viewport: { width: 1280, height: 800 },
  });

  // Remove navigator.webdriver flag to bypass CAPTCHA detection
  context.on("page", async (page) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
  });

  for (const site of requestedSites) {
    console.log(`\n--- ${site.name} ---`);
    console.log(`Opening: ${site.url}`);

    const page = await context.newPage();
    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });

    console.log(`\n  ➡️  Please log in to ${site.name} in the browser window.`);
    console.log(`  ➡️  Complete any CAPTCHA / "are you human" checks.`);
    console.log(`  ➡️  Once logged in, come back here and press Enter to continue.\n`);

    await askUser(`  Press Enter when done with ${site.name}... `);

    console.log(`  ✅ ${site.name} session saved.`);
    await page.close();
  }

  await context.close();

  console.log("\n=== All done! ===");
  console.log("Sessions have been saved. You can now run tests with:");
  console.log("  npm test");
  console.log("  npm run test:behavior");
  console.log("");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
