/**
 * Update-path regression test.
 *
 * New sites must use optional host permissions so Firefox can request access
 * only after the user chooses to enable that site.
 */
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");

test("new sites use optional permissions without expanding required access", async () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, "baseline-manifest.json"), "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "manifest.json"), "utf8"));
  const configs = fs.readFileSync(path.join(REPO_ROOT, "constants", "site-configs.js"), "utf8");
  const baselineRequired = new Set(baseline.host_permissions);
  const currentOptional = new Set(manifest.optional_host_permissions);

  expect(manifest.background).toEqual({ scripts: ["service-worker.js"], type: "module" });
  for (const host of manifest.host_permissions) {
    expect(baselineRequired, `Required permission is new since ${baseline.version}: ${host}`).toContain(host);
  }

  const optionalEntries = [...configs.matchAll(/\{ hostname: "[^"]+", matchPatterns: \[([^\]]+)\], optional: true \}/g)];
  expect(optionalEntries.length).toBeGreaterThan(0);
  for (const [, patterns] of optionalEntries) {
    for (const [, pattern] of patterns.matchAll(/"(https:\/\/[^"]+)"/g)) {
      expect(currentOptional, `Opt-in host must be an optional permission: ${pattern}`).toContain(pattern);
    }
  }
});
