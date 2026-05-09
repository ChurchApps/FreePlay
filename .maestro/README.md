# FreePlay E2E tests (Maestro)

End-to-end tests for the Android TV build of FreePlay, driven by [Maestro](https://maestro.mobile.dev/). tvOS is intentionally out of scope — see the test plan for rationale.

## One-time setup

### 1. Install Maestro CLI

```powershell
# Windows (via PowerShell, requires Java 11+)
iwr -useb https://get.maestro.mobile.dev | iex
maestro --version
```

macOS / Linux: `curl -Ls "https://get.maestro.mobile.dev" | bash`.

### 2. Create the Android TV emulator

In Android Studio → Device Manager → **Create device**:

- Category: **TV**
- Hardware profile: **Television (1080p)**
- System image: **Google TV ATV 14 (API 34) x86_64** (or ATV 13 if 14 is unstable on your machine)
- AVD name: **freeplay_atv_test**
- Advanced: 2 GB RAM, no SD card, host GPU on, boot animation off.

Boot once via Android Studio so the emulator unlocks first-run setup, then it can be launched headless from the command line:

```powershell
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd freeplay_atv_test -no-window -no-audio -no-snapshot
```

### 3. Build & install the app

From `FreePlay/`:

```powershell
npm ci
npx expo prebuild --clean
npm run android   # installs a debug APK to the running emulator
```

Verify the app appears on the emulator's Home → Apps.

## Running tests

```powershell
# Single flow
maestro test .maestro/flows/01-splash-loads.yaml

# Full suite
maestro test .maestro/flows/

# With JUnit output (for CI)
maestro test .maestro/flows/ --format junit --output report/
```

## Project layout

```
.maestro/
├── config.yaml              # appId + flow glob
├── README.md                # this file
├── flows/                   # one .yaml per test, numbered by tier
│   └── 01-splash-loads.yaml
├── subflows/                # reusable building blocks (pairToChurch, etc.)
└── scripts/                 # JS for runScript: blocks (e.g. backend pairing approval)
```

## Conventions

- **testID format:** `screen-element[-modifier]`, kebab-case, screen prefix mandatory. Dynamic ids include the entity id, e.g. `providers-card-{providerId}`.
- **Focus state:** focusable elements append `-focused` to their testID when they have TV focus, so flows can assert focus with `assertVisible: id: "providers-card-freeshow-focused"`.
- **Match both bare and focused with `(-focused)?`:** assertions that don't care whether an element is focused must include the optional regex suffix, otherwise the focused card's bare-id assertion fails (Maestro's id selector is regex-anchored). Example: `id: "providers-card-b1church(-focused)?"`.
- **No fixed waits:** prefer `extendedWaitUntil` over `wait` — the app has 1.2s splash delays and 3s pairing polls, and timing varies by emulator load.
- **Every flow starts at splash:** the app uses a custom string-based navigator with no deep-linking, so `launchApp: clearState: true` is the only entry point.

## Maestro 2.5.1 limitations encountered

- **No D-pad direction keys via `pressKey` YAML.** The runtime `KeyCode` enum defines `REMOTE_LEFT`/`REMOTE_RIGHT`/`REMOTE_UP`/`REMOTE_DOWN`/`REMOTE_CENTER`, but the YAML parser rejects every casing variant tried (`Left`, `RemoteLeft`, `REMOTE_LEFT`, `remote_left`). `back`, `home`, `enter`, etc. work. Tests that need true D-pad navigation must drive the emulator via `adb shell input keyevent 21` (DPAD_LEFT) etc. between Maestro invocations, or use a hardware-back proxy when the underlying handler is the same.
- **Cold Metro bundle download** can take 30+ seconds on the first launch after `npm start`. Always wrap the first `assertVisible` with `extendedWaitUntil … timeout: 60000` for `splash-root`.

## Tiered test inventory

| Tier | Files | Status |
|------|-------|--------|
| 1 — golden paths (PR-blocking) | `01-splash-loads`, `02-providers-list-renders`, `03-sidebar-toggle`, `04-tap-provider-shows-device-auth`, `05-app-relaunch` | 5/5 passing |
| 2 — broader coverage | `14-provider-device-auth-cancel`, `17-downloads-list` | 2/2 passing |
| Lessons.church streaming + download (online) | `30-stream-lessonschurch`, `31-download-lessonschurch` | 2/2 passing |
| Offline (separate runner — see below) | `flows-offline/32-play-downloaded-offline` | passing via run-offline.ps1 |
| 3 — nice-to-have (incl. real D-pad navigation, requires adb helper) | `20-*` through `23-*` | not started |

## Offline mode

Flow `32-play-downloaded-offline` lives in `.maestro/flows-offline/` (deliberately outside the default `flows/` glob) because it requires the AVD's wifi to be off and a previous successful run of `31-download-lessonschurch` to leave cached files on disk.

Run it via the wrapper:

```powershell
pwsh .maestro/scripts/run-offline.ps1
```

The wrapper toggles `adb shell svc wifi disable` before invoking Maestro and re-enables wifi on exit (even on failure). Metro bundle delivery still works because `adb reverse tcp:8081 tcp:8081` goes through the adb pipe, not the AVD's wifi stack.

**Required ordering**: run `maestro test .maestro/flows/` first to get the download in place, then `pwsh .maestro/scripts/run-offline.ps1`. Don't add a `clearState: true` flow between 31 and the offline run.

See the test plan at `~/.claude/plans/alright-make-a-plan-sprightly-moon.md` for the full inventory and rationale.

## Known non-goals

These are deliberately not tested by this suite:

- Real video frame playback / audio output (covered by unit tests on `PlayerHelper`).
- tvOS — Maestro can't drive Apple TV focus; planned as a separate Appium effort.
- Third-party OAuth login UIs (Google, etc.) where we don't control the IdP.
- Firebase Analytics event emission — verify via Firebase DebugView.
- Pixel-perfect focus animation timing.

## Currently unreachable from the UI (not blocked, but no entry point exists)

These screens still exist in the codebase but no UI element navigates to them, so end-to-end tests aren't meaningful until an entry point is restored:

- `PlanPairingScreen`, `PlanDownloadScreen` — only reachable from the removed `SelectPairingMode` flow.
- `OfflineScreen` — only navigated to from `PlanDownloadScreen`.
- `PrivacyPolicyScreen` — no nav item points to it in `NavWrapper`.
- The classroom flow (`SelectChurchScreen`, `SelectRoomScreen`, `DownloadScreen`) — screens deleted.

## Discovered behavior worth flagging

- The "cancel" button on `ProviderDeviceAuthScreen` only stops polling and expands the sidebar — it does **not** navigate away from the device-auth screen. The user is left on the same screen with the sidebar open. If that's not the intent, the handler should also call `navigateTo("providers")`.
