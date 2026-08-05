/**
 * Permission-warning regression test.
 *
 * Chrome disables an extension on update (until the user re-approves) only
 * when the new version introduces permission WARNINGS that the old version
 * did not have. This test compares the current manifest against the last
 * released baseline and fails if any new warning would appear — i.e. it
 * guarantees the next update installs silently for all existing users.
 *
 * chrome.management.getPermissionWarningsByManifest() is callable without
 * the "management" permission.
 *
 * baseline-manifest.json is a copy of the last published manifest; refresh it
 * after a release so the comparison keeps describing what users actually have.
 */
const { test } = require("./fixtures");
const { expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASELINE_MANIFEST = path.join(__dirname, "baseline-manifest.json");
const CURRENT_MANIFEST = path.join(__dirname, "..", "manifest.json");

function getPermissionWarnings(serviceWorker, manifestJson) {
  return serviceWorker.evaluate(
    (manifestStr) =>
      new Promise((resolve) => {
        chrome.management.getPermissionWarningsByManifest(manifestStr, resolve);
      }),
    manifestJson
  );
}

test.describe("Permission Warnings", () => {
  test("update must not introduce new permission warnings", async ({ context }) => {
    let serviceWorker;
    if (context.serviceWorkers().length > 0) {
      serviceWorker = context.serviceWorkers()[0];
    } else {
      serviceWorker = await context.waitForEvent("serviceworker");
    }

    const baseline = fs.readFileSync(BASELINE_MANIFEST, "utf-8");
    const current = fs.readFileSync(CURRENT_MANIFEST, "utf-8");

    const baselineWarnings = await getPermissionWarnings(serviceWorker, baseline);
    const currentWarnings = await getPermissionWarnings(serviceWorker, current);

    console.log(`  Baseline (v${JSON.parse(baseline).version}) warnings:`, baselineWarnings);
    console.log("  Current manifest warnings:", currentWarnings);

    for (const warning of currentWarnings) {
      expect(baselineWarnings, `New permission warning would disable the extension for all users on update: "${warning}"`).toContain(warning);
    }
  });
});
