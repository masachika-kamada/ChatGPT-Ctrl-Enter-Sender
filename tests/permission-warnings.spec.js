/**
 * Permission-warning regression test.
 *
 * Adding a required host can require Firefox users to approve an update.
 * Compare the manifest against the last published version so all new hosts
 * remain opt-in. Refresh the baseline after each release.
 */
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASELINE_MANIFEST = path.join(__dirname, "baseline-manifest.json");
const CURRENT_MANIFEST = path.join(__dirname, "..", "manifest.json");

test.describe("Permission Update Regression", () => {
  test("update must not introduce required host permissions", async () => {
    const baseline = fs.readFileSync(BASELINE_MANIFEST, "utf-8");
    const current = fs.readFileSync(CURRENT_MANIFEST, "utf-8");

    const baselineRequiredHosts = new Set(JSON.parse(baseline).host_permissions ?? []);
    for (const host of JSON.parse(current).host_permissions ?? []) {
      expect(
        baselineRequiredHosts,
        `New required host permission was added: "${host}"`
      ).toContain(host);
    }
  });
});
