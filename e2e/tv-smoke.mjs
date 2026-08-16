/* Android TV smoke suite: installs the debug APK on a TV emulator/device and
   walks the core screens over adb, asserting on uiautomator dumps.
   Prereqs: a booted Android TV emulator (or set ANDROID_SERIAL) and a built
   android/app/build/outputs/apk/debug/app-debug.apk. Metro is started
   automatically if not already running. */
import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ADB = process.env.ADB_PATH || "C:/Program Files/Android/platform-tools/adb.exe";
const PKG = "church.freeplay";
const APK = path.join(root, "android/app/build/outputs/apk/debug/app-debug.apk");
const artifacts = path.join(root, "e2e/artifacts");
fs.mkdirSync(artifacts, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...args) => execFileSync(ADB, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const adbBin = (...args) => execFileSync(ADB, args, { maxBuffer: 64 * 1024 * 1024 });

const KEys = { up: 19, down: 20, left: 21, right: 22, enter: 23, back: 4 };
const press = async (key, times = 1) => {
  for (let i = 0; i < times; i++) {
    adb("shell", "input", "keyevent", String(KEys[key]));
    await sleep(700);
  }
};

const dumpUi = () => {
  try {
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
    return adb("shell", "cat", "/sdcard/ui.xml");
  } catch {
    return "";
  }
};

// Label of the currently focused card: first non-empty text under the focused node.
const focusedText = () => {
  const ui = dumpUi();
  const idx = ui.indexOf('focused="true"');
  if (idx < 0) return "";
  const m = ui.slice(idx, idx + 2000).match(/text="([^"]+)"/);
  return m ? m[1] : "";
};

// DPad-walk the provider grid until the target card is focused.
async function walkToCard(target, maxMoves = 20) {
  let prev = "";
  for (let i = 0; i < maxMoves; i++) {
    const label = focusedText();
    if (label === target) return true;
    if (label === prev) await press("down"); else await press("right");
    prev = label;
  }
  return false;
}

const screenshot = (name) => {
  const png = adbBin("exec-out", "screencap", "-p");
  fs.writeFileSync(path.join(artifacts, `${name}.png`), png);
};

const results = [];
let stepNo = 0;

async function expectAny(name, needles, timeoutMs = 30000) {
  stepNo++;
  const deadline = Date.now() + timeoutMs;
  let ui = "";
  while (Date.now() < deadline) {
    ui = dumpUi();
    const hit = needles.find((n) => ui.includes(n));
    if (hit) {
      screenshot(`${String(stepNo).padStart(2, "0")}-${name}`);
      results.push({ name, pass: true, hit });
      console.log(`  PASS ${name} (found "${hit}")`);
      return;
    }
    await sleep(2000);
  }
  screenshot(`${String(stepNo).padStart(2, "0")}-${name}-FAIL`);
  fs.writeFileSync(path.join(artifacts, `${name}-FAIL.xml`), ui);
  results.push({ name, pass: false });
  console.log(`  FAIL ${name} — none of ${JSON.stringify(needles)} on screen`);
}

function assertAppAlive(name) {
  stepNo++;
  const pid = adb("shell", "pidof", PKG).trim();
  const pass = pid.length > 0;
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"} ${name}${pass ? ` (pid ${pid})` : " — process not running"}`);
}

async function ensureMetro() {
  const status = () =>
    new Promise((resolve) => {
      http.get("http://localhost:8081/status", (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => resolve(body.includes("packager-status:running")));
      }).on("error", () => resolve(false));
    });
  if (await status()) return console.log("Metro already running.");
  console.log("Starting Metro...");
  const child = spawn("cmd", ["/c", "yarn", "expo", "start", "--port", "8081"], {
    cwd: root,
    env: { ...process.env, EXPO_TV: "1", CI: "1" },
    detached: true,
    stdio: ["ignore", fs.openSync(path.join(artifacts, "metro.log"), "a"), fs.openSync(path.join(artifacts, "metro.log"), "a")]
  });
  child.unref();
  for (let i = 0; i < 60; i++) {
    if (await status()) return console.log("Metro up.");
    await sleep(2000);
  }
  throw new Error("Metro failed to start (see e2e/artifacts/metro.log)");
}

async function main() {
  const booted = adb("shell", "getprop", "sys.boot_completed").trim();
  if (booted !== "1") throw new Error("No booted device. Start the TV emulator first.");
  const isTv = adb("shell", "pm", "list", "features").includes("android.software.leanback");
  console.log(`Device: ${adb("shell", "getprop", "ro.product.model").trim()} (leanback=${isTv})`);
  if (!fs.existsSync(APK)) throw new Error(`APK not found: ${APK}. Run: cd android && EXPO_TV=1 ./gradlew assembleDebug`);

  await ensureMetro();
  adb("reverse", "tcp:8081", "tcp:8081");
  console.log("Installing APK...");
  adb("install", "-r", APK);
  adb("shell", "pm", "clear", PKG);
  adb("reverse", "tcp:8081", "tcp:8081");

  console.log("Launching app...");
  adb("shell", "am", "start", "-n", `${PKG}/.MainActivity`);

  // First load waits on Metro's initial bundle build.
  await expectAny("providers-screen-after-splash", ["Content Providers"], 240000);
  assertAppAlive("app-process-alive");

  if (process.argv[2] === "googledrive") {
    await scenarioGoogleDrive();
    return finish();
  }

  // Provider cards render
  await expectAny("provider-cards-listed", ["Lessons.church", "SignPresenter", "B1 Church", "BibleProject"], 15000);

  // Connect a no-auth provider (BibleProject) → lands in its content browser
  await press("down");
  await press("enter");
  await expectAny("provider-content-browser", ["The Bible Project", "Old Testament Overviews"], 45000);

  // Open the focused folder → item grid
  await press("enter");
  await expectAny("content-folder-open", ["Genesis", "Exodus", "Overview"], 45000);

  // Open the focused item → Download/Stream screen
  await press("enter");
  await expectAny("item-download-stream", ["Stream", "Download"], 45000);

  // Stream it → player should start without crashing (player BACK returns to the folder)
  await press("right");
  await press("enter");
  await sleep(12000);
  assertAppAlive("player-streaming-alive");
  screenshot("player-streaming");
  await press("back");
  await expectAny("back-to-folder", ["Genesis", "Exodus"], 20000);
  await press("back");
  await expectAny("back-to-browser-root", ["Old Testament Overviews"], 20000);

  // Restart without clearing data: connection must persist, and we get a
  // deterministic focus position for the sidebar walk.
  adb("shell", "am", "force-stop", PKG);
  await sleep(2000);
  adb("shell", "am", "start", "-n", `${PKG}/.MainActivity`);
  await expectAny("reconnects-on-restart", ["The Bible Project", "Old Testament Overviews"], 120000);

  // BACK at browser root expands the sidebar
  await press("back");
  await expectAny("sidebar-expanded", ["Downloads", "Providers"], 15000);

  // Sidebar → Downloads
  await press("down");
  await press("enter");
  await expectAny("downloads-empty-state", ["No downloads yet"], 20000);

  // Sidebar → Providers; connected provider shows as Connected
  await press("left", 2);
  await expectAny("sidebar-expanded-again", ["Providers"], 15000);
  await press("down");
  await press("enter");
  await expectAny("providers-screen-return", ["Content Providers"], 20000);
  await expectAny("provider-shows-connected", ["Connected"], 15000);

  assertAppAlive("app-process-alive-end");
  finish();
}

// Google Drive is OAuth (QR + phone sign-in via the MembershipApi relay), so the
// automated check stops at a healthy "waiting for confirmation" QR screen.
async function scenarioGoogleDrive() {
  await expectAny("googledrive-card-listed", ["Google Drive"], 15000);
  const found = await walkToCard("Google Drive");
  results.push({ name: "focus-googledrive-card", pass: found });
  console.log(`  ${found ? "PASS" : "FAIL"} focus-googledrive-card`);
  if (!found) return;
  await press("enter");
  await expectAny("googledrive-oauth-screen", ["Connect to Google Drive"], 30000);
  await expectAny("googledrive-qr-waiting", ["Waiting for confirmation"], 30000);
  await sleep(12000);
  await expectAny("googledrive-polling-stable", ["Waiting for confirmation"], 10000);
  assertAppAlive("googledrive-app-alive");
}

function finish() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Artifacts in e2e/artifacts/`);
  if (failed.length) {
    console.log("Failed: " + failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
