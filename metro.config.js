// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const fs = require('fs');
const contentProvidersPath = path.resolve(__dirname, '../Packages/content-providers');

const config = getSentryExpoConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

// Support file-linked local packages (symlinks) - only when the local path exists
if (fs.existsSync(contentProvidersPath)) {
  config.watchFolders = [contentProvidersPath];
}
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

// When enabled, the optional code below will allow Metro to resolve
// and bundle source files with TV-specific extensions
// (e.g., *.ios.tv.tsx, *.android.tv.tsx, *.tv.tsx)
//
// Metro will still resolve source files with standard extensions
// as usual if TV-specific files are not found for a module.
//
if (process.env?.EXPO_TV === '1') {
  const originalSourceExts = config.resolver.sourceExts;
  const tvSourceExts = [
    ...originalSourceExts.map((e) => `tv.${e}`),
    ...originalSourceExts,
  ];
  config.resolver.sourceExts = tvSourceExts;
}

module.exports = config;
