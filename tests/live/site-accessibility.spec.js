/**
 * Site accessibility tests — checks if each supported site is reachable
 * and the expected input element exists.
 * Separates auth-required sites (skip with warning) from public sites (full test).
 */
const { test } = require("./fixtures");
const { expect } = require("@playwright/test");
const { SITES } = require("./site-definitions");

// Filter to only sites that don't require auth for CI-friendly testing
const publicSites = SITES.filter((s) => !s.requiresAuth);
const authSites = SITES.filter((s) => s.requiresAuth);

test.describe("Public Sites — Input Detection", () => {
  for (const site of publicSites) {
    test(`${site.name}: should find input element`, async ({ context }) => {
      const page = await context.newPage();

      try {
        await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        // Wait a bit for dynamic content to load
        await page.waitForTimeout(3000);

        const input = await page.$(site.inputSelector);

        if (input) {
          console.log(`  ✅ ${site.name}: Input element found (${site.inputSelector})`);
        } else {
          // Not a hard failure — site may have changed its DOM
          console.log(`  ⚠️ ${site.name}: Input element NOT found (${site.inputSelector})`);
          console.log(`     Page URL: ${page.url()}`);

          // Take a screenshot for debugging
          await page.screenshot({
            path: `tests/screenshots/${site.name.toLowerCase()}-input-not-found.png`,
          });
        }

        expect(input).not.toBeNull();
      } finally {
        await page.close();
      }
    });
  }
});

test.describe("Auth Sites — Input Detection (requires login)", () => {
  for (const site of authSites) {
    test(`${site.name}: should find input element (auth required)`, async ({ context }) => {
      const page = await context.newPage();

      try {
        await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(5000);

        const input = await page.$(site.inputSelector);

        if (input) {
          console.log(`  ✅ ${site.name}: Input element found`);
        } else {
          // Check if we were redirected to a login page
          const currentUrl = page.url();
          console.log(`  ⚠️ ${site.name}: Input not found. Current URL: ${currentUrl}`);
          console.log(`     This is expected if not logged in.`);

          await page.screenshot({
            path: `tests/screenshots/${site.name.toLowerCase()}-needs-auth.png`,
          });
        }

        // Soft assertion — we expect this might fail without auth
        test.info().annotations.push({
          type: "note",
          description: input ? "Input found" : "Login required — input not found",
        });
      } finally {
        await page.close();
      }
    });
  }
});
