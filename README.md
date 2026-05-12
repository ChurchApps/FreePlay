# FreePlay

> **FreePlay** is a companion app for [freeplay.church](https://freeplay.church/). It runs on any Android TV device and will pre-fetch each weeks lesson in the classroom so they're ready to be displayed on Sunday without needing an Internet connection. The lessons can be scheduled in advance for classrooms and customized.

## Preview

<div style="display: flex;gap: 10px;">
    <img style="width: 49%;" src="https://github.com/ChurchApps/LessonsScreen/assets/1447203/848078b5-69dc-4575-826f-47d5e4ac4f9e">
    <img style="width: 49%;" src="https://github.com/ChurchApps/LessonsScreen/assets/1447203/f9aa6b4f-ae54-4a80-a82d-d28355b56ca0">
</div>
<div style="display: flex;gap: 10px;margin-top: 10px;">
    <img style="width: 49%;" src="https://github.com/ChurchApps/LessonsScreen/assets/1447203/ce2a8889-603e-4248-b1dd-43e201e7a151">
    <img style="width: 49%;" src="https://github.com/ChurchApps/LessonsScreen/assets/1447203/b3d234fb-6f88-4ee2-873c-c5b70449fb90">
</div>

## Get Involved

### 🤝 Help Support Us

The only reason this program is free is because of the generous support from users. If you want to support us to keep this free, please head over to [ChurchApps](https://churchapps/partner) or [sponsor us on GitHub](https://github.com/sponsors/ChurchApps/). Thank you so much!

### 🏘️ Join the Community

We have a great community for end-users on [Facebook](https://www.facebook.com/churchapps.org). It's a good way to ask questions, get tips and follow new updates. Come join us!

### ⚠️ Report an Issue

If you discover an issue or have a feature request, simply submit it to our [issues log](https://github.com/ChurchApps/ChurchAppsSupport/issues). Don't be shy, that's how the program gets better.

### 💬 Join us on Slack

If you would like to contribute in any way, head over to our [Slack Channel](https://join.slack.com/t/livechurchsolutions/shared_invite/zt-i88etpo5-ZZhYsQwQLVclW12DKtVflg) and introduce yourself. We'd love to hear from you.

### 🏗️ Start Coding

If you'd like to set up the project locally, see our [development guide](https://churchapps.org/dev). For this app:

1. **Update .env** - to point to production or your dev environment.
2. **Start React Native** - Run `npm start` to start the React Native server.
3. **Install Android App** - In Android Studio open the /android folder. Either configure a new Android TV emulator or connect a AndroidTV device and click the run button to install the app.
4. **Connect App to React Native** - Run `adb shell input keyevent 82` to open the developer menu. Go to settings, Debug server host and enter YourIP:8081. Restart the app via Android Studio.

## Release build

1. Make sure the environment variables point to the production servers in EnvironmentHelper.ts
2. Increment the version number in android/app/build.gradle
3. Run `cd android` followed by `gradlew bundleRelease` to produce the release bundle. (If fails, File->Invalidate Caches in Android Studio)
4. Run `cd..` followed by `react-native run-android --variant=release` to generate an apk file. You can close the node window when it completes.
5. The apk file is located at `android/app/build/outputs/apk/release/app-release.apk`. Publish it to the Amazon and Google Play stores.

## White-Labeling (Forking for Your Church / Org)

FreePlay is designed to be forked and re-skinned. You can lock it to a single content provider (e.g. only `lifechurch`), give it your own name, icons, and colors, and ship it under your own developer accounts to the App Store, Google Play, and Amazon Appstore.

The entire customization surface is one file — `branding.json` — plus the asset files you replace. **No TypeScript changes required.**

### Steps

1. **Fork the repo** on GitHub.

2. **Edit `branding.json`** at the repo root. Required fields to change:
   - `appName` — display name on the device
   - `slug` — Expo slug (must be unique)
   - `scheme` — deep-link URL scheme (e.g. `church.yourorg.player`)
   - `owner` — your Expo account owner
   - `android.package` — Play / Amazon bundle ID
   - `ios.bundleIdentifier` — App Store bundle ID
   - `eas.projectId` — from `npx eas init` (see step 5)
   - `eas.updatesUrl` — Expo gives you this when you create the project
   - `sentry.organization` / `sentry.project` — if you use Sentry; otherwise remove the Sentry plugin from `app.config.js`
   - `providerIds` — array of provider IDs to expose. **Set to a single entry (e.g. `["lifechurch"]`) to lock the app to one provider and skip the picker screen entirely.**
   - `colors.primary` — your brand accent color (hex). Light/dark variants and tinted overlays are also configurable; if you only set `primary`, the overlay tints derive from it automatically.
   - `tvosSubmit` — your `ascAppId` and `appleTeamId` for tvOS submission (only needed if you ship to Apple TV)

3. **Replace assets** (keep the same filenames so `app.config.js` doesn't need to change):
   - `assets/images/icon.png` — app icon
   - `assets/images/splash.png` — splash screen
   - `assets/images/tv_banner.png` — Android TV banner
   - `assets/images/tv_icon.png` — Android TV icon
   - `assets/images/icon-*.png` — the Apple TV image set (icon-1280x768, icon-400x240, icon-800x480, icon-1920x720, icon-3840x1440, icon-2320x720, icon-4640x1440)
   - `src/images/logo.png`, `src/images/logo-white.png`, `src/images/logo-icon.png` — in-app logos

4. **Replace Firebase configs** (or remove Firebase):
   - `google-services.json` — Android Firebase config from your Firebase project
   - `GoogleService-Info.plist` — iOS Firebase config from your Firebase project
   - If you don't need Firebase, remove `"@react-native-firebase/app"` from the `plugins` array in `app.config.js`.

5. **Create your EAS project** under your Expo account:
   ```
   npx eas init
   ```
   Paste the generated project ID into `branding.json` `eas.projectId`. EAS will also print the updates URL — paste that into `eas.updatesUrl`.

6. **Update `eas.json` submit credentials** (only if shipping to tvOS):
   - `submit.tvos-production.ios.ascAppId` and `appleTeamId` — match what you put in `branding.json`. These are read by `eas submit`, not by the app.

7. **Build**:
   ```
   eas build --profile production --platform android       # Play Store
   eas build --profile amazon                              # Amazon Appstore
   eas build --profile tvos-production --platform ios      # Apple TV
   ```

### Keeping in sync with upstream

```
git remote add upstream https://github.com/ChurchApps/FreePlay.git
git pull upstream main
```

Your changes live almost entirely in `branding.json` and binary asset files, so merge conflicts in source code should be rare.

### How the locked-provider mode works

When `branding.json` has exactly one entry in `providerIds`:

- The "Providers" picker screen is skipped — after the splash, the app routes the user directly into that provider's auth flow (or straight to its content if it doesn't require auth).
- The "Providers" entry is hidden from the sidebar navigation.
- The Provider Settings screen still lets the user disconnect / re-authenticate, but doesn't offer to switch providers.

With multiple entries in `providerIds`, the app behaves exactly as upstream FreePlay does today.

# Testing on Windows

1. Install Windows Susbystem for Android
2. Intall Amazon App Store for Windows and open it.
3. Run `adb connect 127.0.0.1:58526`
4. Start the React Native server with `npm start`
5. In Android Study, select `Microsoft...` as the device and click Run.
6. Run `adb shell input keyevent 82` to open the developer menu. Go to settings, Debug server host and enter YourIP:8081. Restart the app via Android Studio.