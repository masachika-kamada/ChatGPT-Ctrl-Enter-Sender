/**
 * Ctrl+Enter behavior tests.
 *
 * For each site, verifies:
 *   1. Enter alone → inserts a newline (does NOT submit)
 *   2. Ctrl+Enter → submits the message
 *
 * Verification:
 *   - Enter: text content grows (newline) or stays (not cleared)
 *   - Ctrl+Enter: input cleared / response appears / loading indicator / stop button
 *
 * Auth-required sites are skipped if input is not found.
 * Run "node tests/login-helper.js" first to log in.
 */
const { test } = require("./fixtures");
const { expect } = require("@playwright/test");
const { SITES } = require("./site-definitions");

const TEST_TEXT = "test_ctrl_enter_extension";
const NEWLINE_TEST_TEXT = "line1";

/** Type text into an input element. */
async function typeIntoInput(page, selector, text) {
  const input = await page.waitForSelector(selector, { timeout: 10000 });
  await input.click();
  await page.waitForTimeout(300);
  await page.keyboard.type(text, { delay: 50 });
  await page.waitForTimeout(300);
  return input;
}

/** Get the text content from an input element. */
async function getInputContent(page, selector, inputType) {
  const input = await page.$(selector);
  if (!input) return "";
  if (inputType === "contenteditable") {
    return await input.evaluate((el) => el.innerText || el.textContent || "");
  }
  return await input.evaluate((el) => el.value || el.innerText || "");
}

/** Count lines in text. */
function countLines(text) {
  return text ? text.split("\n").length : 0;
}

/**
 * Detect message submission via multiple signals:
 *   1. Input field was cleared
 *   2. The typed text appears elsewhere (chat bubble)
 *   3. Loading/spinner indicator appeared
 *   4. Stop/cancel button appeared
 */
async function detectSubmission(page, selector, inputType, textBefore) {
  await page.waitForTimeout(3000);
  const contentAfter = await getInputContent(page, selector, inputType);

  const inputCleared = contentAfter.trim() === "" && textBefore.trim() !== "";

  const textInPage = await page.evaluate((searchText) => {
    return (document.body.innerText || "").split(searchText).length - 1;
  }, textBefore.trim());
  const textEchoed = textInPage >= 2 || (inputCleared && textInPage >= 1);

  const loadingSelectors = [
    '[class*="loading"]', '[class*="spinner"]', '[class*="typing"]',
    '[class*="generating"]', '[class*="thinking"]', '[class*="streaming"]',
    '[data-testid*="loading"]', 'svg[class*="animate"]',
  ];
  let hasLoading = false;
  for (const sel of loadingSelectors) {
    if (await page.$(sel)) { hasLoading = true; break; }
  }

  const hasStopButton = !!(await page.$('button[aria-label*="Stop"], button[aria-label*="stop"], button[class*="stop"]'));

  const signals = { inputCleared, textEchoed, hasLoading, hasStopButton };
  const submitted = inputCleared || textEchoed || hasLoading || hasStopButton;

  const reasons = [];
  if (inputCleared) reasons.push("input cleared");
  if (textEchoed) reasons.push("text in chat");
  if (hasLoading) reasons.push("loading indicator");
  if (hasStopButton) reasons.push("stop button");

  return {
    submitted,
    signals,
    reason: submitted
      ? `Submitted (${reasons.join(", ")})`
      : `NOT submitted — input: "${contentAfter.substring(0, 40)}"`,
  };
}

/** Navigate to site and try to find the input element. */
async function findInput(page, site) {
  await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(site.requiresAuth ? 5000 : 3000);
  return await page.$(site.inputSelector);
}

// ========== PUBLIC SITES ==========
const publicSites = SITES.filter((s) => !s.requiresAuth);

test.describe("Ctrl+Enter Behavior — Public Sites", () => {
  for (const site of publicSites) {
    test.describe(site.name, () => {

      test("Enter should insert newline, NOT submit", async ({ context }) => {
        test.setTimeout(45000);
        const page = await context.newPage();
        try {
          const input = await findInput(page, site);
          if (!input) { test.skip(true, `Input not found on ${site.name}`); return; }

          await typeIntoInput(page, site.inputSelector, NEWLINE_TEST_TEXT);
          const contentBefore = await getInputContent(page, site.inputSelector, site.inputType);
          const linesBefore = countLines(contentBefore);

          await page.keyboard.press("Enter");
          await page.waitForTimeout(1500);

          const contentAfter = await getInputContent(page, site.inputSelector, site.inputType);
          const linesAfter = countLines(contentAfter);

          await page.screenshot({ path: `tests/screenshots/${site.name.toLowerCase()}-enter-result.png` });

          const wasSubmitted = contentAfter.trim() === "" && contentBefore.trim() !== "";
          const newlineInserted = linesAfter > linesBefore || contentAfter.includes("\n");

          console.log(`  ${site.name} Enter:`);
          console.log(`    Before: "${contentBefore.replace(/\n/g, "\\n")}"`);
          console.log(`    After:  "${contentAfter.replace(/\n/g, "\\n")}"`);
          console.log(`    Lines: ${linesBefore} → ${linesAfter}`);
          console.log(`    ${wasSubmitted ? "❌ Submitted!" : newlineInserted ? "✅ Newline inserted" : "⚠️ No submit, no newline"}`);

          expect(wasSubmitted, `Enter should NOT submit on ${site.name}`).toBe(false);
        } finally { await page.close(); }
      });

      test("Ctrl+Enter should submit the message", async ({ context }) => {
        test.setTimeout(45000);
        const page = await context.newPage();
        try {
          const input = await findInput(page, site);
          if (!input) { test.skip(true, `Input not found on ${site.name}`); return; }

          const uniqueText = `${TEST_TEXT}_${Date.now()}`;
          await typeIntoInput(page, site.inputSelector, uniqueText);
          const contentBefore = await getInputContent(page, site.inputSelector, site.inputType);

          await page.keyboard.press("Control+Enter");
          const result = await detectSubmission(page, site.inputSelector, site.inputType, contentBefore);

          await page.screenshot({ path: `tests/screenshots/${site.name.toLowerCase()}-ctrl-enter-result.png` });

          console.log(`  ${site.name} Ctrl+Enter:`);
          console.log(`    ${result.reason}`);
          console.log(`    Signals: ${JSON.stringify(result.signals)}`);
          console.log(`    ${result.submitted ? "✅ Submitted" : "❌ NOT submitted"}`);

          expect(result.submitted, `Ctrl+Enter should submit on ${site.name}: ${result.reason}`).toBe(true);
        } finally { await page.close(); }
      });
    });
  }
});

// ========== AUTH-REQUIRED SITES ==========
const authSites = SITES.filter((s) => s.requiresAuth);

test.describe("Ctrl+Enter Behavior — Auth Sites", () => {
  for (const site of authSites) {
    test.describe(site.name, () => {

      test("Enter should insert newline, NOT submit", async ({ context }) => {
        test.setTimeout(45000);
        const page = await context.newPage();
        try {
          const input = await findInput(page, site);
          if (!input) {
            console.log(`  ⏭️ ${site.name}: Skipped — not logged in`);
            await page.screenshot({ path: `tests/screenshots/${site.name.toLowerCase()}-skipped.png` });
            test.skip(true, `${site.name}: not logged in — run "node tests/login-helper.js ${site.name}" first`);
            return;
          }

          await typeIntoInput(page, site.inputSelector, NEWLINE_TEST_TEXT);
          const contentBefore = await getInputContent(page, site.inputSelector, site.inputType);
          const linesBefore = countLines(contentBefore);

          await page.keyboard.press("Enter");
          await page.waitForTimeout(1500);

          const contentAfter = await getInputContent(page, site.inputSelector, site.inputType);
          const linesAfter = countLines(contentAfter);

          await page.screenshot({ path: `tests/screenshots/${site.name.toLowerCase()}-enter-result.png` });

          const wasSubmitted = contentAfter.trim() === "" && contentBefore.trim() !== "";
          const newlineInserted = linesAfter > linesBefore || contentAfter.includes("\n");

          console.log(`  ${site.name} Enter:`);
          console.log(`    Before: "${contentBefore.replace(/\n/g, "\\n")}"`);
          console.log(`    After:  "${contentAfter.replace(/\n/g, "\\n")}"`);
          console.log(`    Lines: ${linesBefore} → ${linesAfter}`);
          console.log(`    ${wasSubmitted ? "❌ Submitted!" : newlineInserted ? "✅ Newline inserted" : "⚠️ No submit, no newline"}`);

          expect(wasSubmitted, `Enter should NOT submit on ${site.name}`).toBe(false);
        } finally { await page.close(); }
      });

      test("Ctrl+Enter should submit the message", async ({ context }) => {
        test.setTimeout(45000);
        const page = await context.newPage();
        try {
          const input = await findInput(page, site);
          if (!input) {
            test.skip(true, `${site.name}: not logged in`);
            return;
          }

          const uniqueText = `${TEST_TEXT}_${Date.now()}`;
          await typeIntoInput(page, site.inputSelector, uniqueText);
          const contentBefore = await getInputContent(page, site.inputSelector, site.inputType);

          await page.keyboard.press("Control+Enter");
          const result = await detectSubmission(page, site.inputSelector, site.inputType, contentBefore);

          await page.screenshot({ path: `tests/screenshots/${site.name.toLowerCase()}-ctrl-enter-result.png` });

          console.log(`  ${site.name} Ctrl+Enter:`);
          console.log(`    ${result.reason}`);
          console.log(`    Signals: ${JSON.stringify(result.signals)}`);
          console.log(`    ${result.submitted ? "✅ Submitted" : "❌ NOT submitted"}`);

          expect(result.submitted, `Ctrl+Enter should submit on ${site.name}: ${result.reason}`).toBe(true);
        } finally { await page.close(); }
      });
    });
  }
});
