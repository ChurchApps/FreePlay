const { withDangerousMod, withInfoPlist } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const isTV = () => /^(1|true)$/i.test(process.env.EXPO_TV ?? "");

function withAndroidTVManifestFixes(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "AndroidManifest.xml"
      );

      let manifest = fs.readFileSync(manifestPath, "utf-8");

      if (!manifest.includes("xmlns:tools")) {
        manifest = manifest.replace(
          "xmlns:android=",
          'xmlns:tools="http://schemas.android.com/tools" xmlns:android='
        );
      }

      // Normalize faketouch so Play does not treat it as required.
      manifest = manifest.replace(
        /\s*<uses-feature[^>]*android\.hardware\.faketouch[^>]*\/>/g,
        ""
      );

      manifest = manifest.replace(
        /(<uses-feature[^>]*android\.hardware\.touchscreen[^>]*\/>)/,
        '$1\n  <uses-feature android:name="android.hardware.faketouch" android:required="false"/>'
      );

      fs.writeFileSync(manifestPath, manifest, "utf-8");
      return config;
    }
  ]);
}

// LSRequiresIPhoneOS makes App Store Connect validate the build as iOS,
// which then rejects every tvOS-shaped key (CFBundlePrimaryIcon string,
// DTPlatformName=appletvos, tvOS provisioning profile). Strip it on tvOS.
function withTVInfoPlistFixes(config) {
  if (!isTV()) return config;
  return withInfoPlist(config, (config) => {
    delete config.modResults.LSRequiresIPhoneOS;
    return config;
  });
}

function withTVManifestFixes(config) {
  config = withAndroidTVManifestFixes(config);
  config = withTVInfoPlistFixes(config);
  return config;
}

module.exports = withTVManifestFixes;
