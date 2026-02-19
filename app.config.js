const appJson = require("./app.json");

const isTvBuild =
  process.env.EXPO_TV === "1" || process.env.EXPO_TV === "true";

const getTvSafePlugins = (plugins = []) =>
  plugins.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "expo-build-properties") {
      return plugin;
    }

    const options = { ...(plugin[1] || {}) };
    const iosOptions = { ...(options.ios || {}) };

    // `useFrameworks: "static"` causes RNFirebase non-modular-header failures on tvOS.
    delete iosOptions.useFrameworks;
    const existingExtraPods = Array.isArray(iosOptions.extraPods) ? iosOptions.extraPods : [];
    const hasGoogleUtilitiesModularHeaders = existingExtraPods.some(
      (pod) => pod?.name === "GoogleUtilities"
    );

    // FirebaseCoreInternal is a Swift pod and requires GoogleUtilities to be modular.
    if (!hasGoogleUtilitiesModularHeaders) {
      existingExtraPods.push({ name: "GoogleUtilities", modular_headers: true });
    }

    iosOptions.extraPods = existingExtraPods;

    if (Object.keys(iosOptions).length > 0) {
      options.ios = iosOptions;
    } else {
      delete options.ios;
    }

    return [plugin[0], options];
  });

module.exports = () => {
  const config = {
    ...appJson,
    expo: {
      ...appJson.expo,
    },
  };

  if (isTvBuild) {
    config.expo.plugins = getTvSafePlugins(appJson.expo.plugins);
  }

  return config;
};
