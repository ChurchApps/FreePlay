const { withAppBuildGradle } = require("expo/config-plugins");

// Signs release builds with the EAS-format credentials.json at the repo root (gitignored).
// Download it once with: npx eas-cli credentials -p android
const RELEASE_SIGNING = `
        release {
            def credsFile = new File(rootDir.parentFile, 'credentials.json')
            if (credsFile.exists()) {
                def ks = new groovy.json.JsonSlurper().parse(credsFile).android.keystore
                storeFile new File(rootDir.parentFile, ks.keystorePath)
                storePassword ks.keystorePassword
                keyAlias ks.keyAlias
                keyPassword ks.keyPassword
            }
        }`;

const RELEASE_SWAP = /\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\s*\n\s*signingConfig signingConfigs\.debug/;

module.exports = (config) =>
  withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes("signingConfigs {") || !RELEASE_SWAP.test(contents)) {
      throw new Error("withReleaseSigning: build.gradle template changed; update this plugin");
    }
    contents = contents.replace("signingConfigs {", `signingConfigs {${RELEASE_SIGNING}`);
    contents = contents.replace(
      RELEASE_SWAP,
      "signingConfig new File(rootDir.parentFile, 'credentials.json').exists() ? signingConfigs.release : signingConfigs.debug"
    );
    config.modResults.contents = contents;
    return config;
  });
