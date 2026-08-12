module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
  transform: { "^.+\\.(ts|tsx|js|jsx)$": "babel-jest" },
  moduleNameMapper: {
    "^react-native$": "<rootDir>/test/mocks/react-native.js",
    "^react-native-fs$": "<rootDir>/test/mocks/react-native-fs.js",
    "^@react-native-async-storage/async-storage$":
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    "^@sentry/react-native$": "<rootDir>/test/mocks/sentry.js",
    "^@react-native-firebase/analytics$": "<rootDir>/test/mocks/firebase-analytics.js",
    "^@churchapps/content-providers$": "<rootDir>/test/mocks/content-providers.js"
  }
};
