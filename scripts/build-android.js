const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
if (!fs.existsSync(path.join(root, "credentials.json"))) {
  console.error("credentials.json not found. Download the release keystore once with:\n  npx eas-cli credentials -p android\nand choose \"credentials.json: Download credentials from EAS\".");
  process.exit(1);
}

const amazon = process.argv[2] === "amazon";
const task = amazon ? "assembleRelease" : "bundleRelease";
const gradlew = path.join(root, "android", process.platform === "win32" ? "gradlew.bat" : "gradlew");
const env = { ...process.env, EXPO_TV: "1" };
if (!process.env.SENTRY_AUTH_TOKEN) {
  console.warn("SENTRY_AUTH_TOKEN not set — skipping Sentry source-map upload (release crashes will be unsymbolicated).");
  env.SENTRY_DISABLE_AUTO_UPLOAD = "true";
}

// A lingering gradle daemon locks android/ and makes prebuild --clean fail with EBUSY.
if (fs.existsSync(gradlew)) {
  try { execSync(`"${gradlew}" --stop`, { stdio: "ignore", cwd: path.join(root, "android") }); } catch { /* daemon may not be running */ }
}
try {
  execSync("yarn expo prebuild -p android --clean", { stdio: "inherit", cwd: root, env });
} catch (e) {
  console.error("\nPrebuild failed. If the error above is EBUSY on the android folder, close any running FreePlay Metro/expo dev sessions (they hold file watchers on android/) and retry.");
  throw e;
}
execSync(`"${gradlew}" ${task}`, { stdio: "inherit", cwd: path.join(root, "android"), env });

const out = amazon ? "android/app/build/outputs/apk/release/app-release.apk" : "android/app/build/outputs/bundle/release/app-release.aab";
console.log(`\nDone: ${out}`);
