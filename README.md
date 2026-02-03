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

# Testing on Windows

1. Install Windows Susbystem for Android
2. Intall Amazon App Store for Windows and open it.
3. Run `adb connect 127.0.0.1:58526`
4. Start the React Native server with `npm start`
5. In Android Study, select `Microsoft...` as the device and click Run.
6. Run `adb shell input keyevent 82` to open the developer menu. Go to settings, Debug server host and enter YourIP:8081. Restart the app via Android Studio.