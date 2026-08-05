// @ts-check
const { defineConfig } = require("@playwright/test");
const path = require("path");

module.exports = defineConfig({
  testDir: "./tests",
  testIgnore: "**/live/**",
  timeout: 60000,
  workers: 1,
  // Extension service worker startup is timing sensitive on loaded CI machines
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    // Chrome extension tests require a persistent context,
    // so most browser config is handled in the test fixtures.
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15000,
    screenshot: "only-on-failure",
  },
});
