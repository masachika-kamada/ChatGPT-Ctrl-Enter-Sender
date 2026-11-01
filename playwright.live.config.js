// @ts-check
const { defineConfig } = require("@playwright/test");
const baseConfig = require("./playwright.config");

module.exports = defineConfig({
  ...baseConfig,
  testDir: "./tests/live",
  testIgnore: [],
});