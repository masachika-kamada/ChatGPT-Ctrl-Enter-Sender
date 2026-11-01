const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

function read(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

// The release workflow refuses to publish when the tag and manifest disagree,
// so a mismatch between these files only surfaces once a tag is already pushed
test("manifest と package と package-lock のバージョンが一致する", () => {
  const manifest = read("manifest.json");
  const pkg = read("package.json");
  const lock = read("package-lock.json");

  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.version, manifest.version);
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[""].version, manifest.version);
});
