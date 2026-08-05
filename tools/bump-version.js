/**
 * Version bump.
 *
 * The release workflow refuses to publish when the tag and manifest disagree,
 * and the version lives in three files, so bumping by hand is a step that can
 * silently fail at the point it is hardest to fix.
 *
 * Usage: npm run bump 2.5.1
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const version = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: npm run bump <major.minor.patch>");
  process.exit(1);
}

function replaceVersion(file) {
  const filePath = path.join(root, file);
  const source = fs.readFileSync(filePath, "utf8");
  const updated = source.replace(/("version":\s*")\d+\.\d+\.\d+(")/, `$1${version}$2`);
  if (updated === source) {
    console.error(`${file}: no version field to update`);
    process.exit(1);
  }
  fs.writeFileSync(filePath, updated);
}

replaceVersion("manifest.json");
replaceVersion("package.json");

// The lock repeats the version for the root package
const lockPath = path.join(root, "package-lock.json");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
lock.version = version;
lock.packages[""].version = version;
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");

console.log(`Bumped to ${version}`);
