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
| 1 — golden paths (PR-blocking) | `01-splash-loads`, `02-providers-list-renders`, `03-sidebar-toggle`, `04-tap-provider-shows-device-auth` | 4/4 passing |
| 2 — broader coverage | `10-*` through `18-*` | not started |
| 3 — nice-to-have (incl. real D-pad navigation, requires adb helper) | `20-*` through `23-*` | not started |

See the test plan at `~/.claude/plans/alright-make-a-plan-sprightly-moon.md` for the full inventory and rationale.

## Known non-goals

These are deliberately not tested by this suite:

- Real video frame playback / audio output (covered by unit tests on `PlayerHelper`).
- tvOS — Maestro can't drive Apple TV focus; planned as a separate Appium effort.
- Third-party OAuth login UIs (Google, etc.) where we don't control the IdP.
- Firebase Analytics event emission — verify via Firebase DebugView.
- Pixel-perfect focus animation timing.
