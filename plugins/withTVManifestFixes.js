const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withTVManifestFixes(config) {
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

      // Ensure tools namespace is declared
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

      // Insert faketouch with required=false after touchscreen declaration.
      manifest = manifest.replace(
        /(<uses-feature[^>]*android\.hardware\.touchscreen[^>]*\/>)/,
        '$1\n  <uses-feature android:name="android.hardware.faketouch" android:required="false"/>'
      );

      // Ensure leanback exists and is required="true".
      if (!manifest.includes('android:name="android.software.leanback"')) {
        manifest = manifest.replace(
          /(<uses-feature[^>]*android\.hardware\.faketouch[^>]*\/>)/,
          '$1\n  <uses-feature android:name="android.software.leanback" android:required="true"/>'
        );
      }

      manifest = manifest.replace(
        /<uses-feature([^>]*android:name="android\.software\.leanback"[^>]*)\/>/,
        (match, attrs) => {
          const normalized = attrs.includes("android:required=")
            ? attrs.replace(/android:required="[^"]*"/, 'android:required="true"')
            : `${attrs} android:required="true"`;
          return `<uses-feature${normalized}/>`;
        }
      );

      fs.writeFileSync(manifestPath, manifest, "utf-8");
      return config;
    },
  ]);
}

module.exports = withTVManifestFixes;
