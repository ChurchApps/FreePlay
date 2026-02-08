import { useEffect } from "react";
import { Navigator } from "./src/navigation/Navigator";

import { EnvironmentHelper } from "./src/helpers/EnvironmentHelper";
import { LogBox } from "react-native";
import { ErrorHelper } from "./src/helpers/ErrorHelper";
import * as Updates from "expo-updates";
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://ac7ef4e2f5095b74c8e5bc623750fefe@o4510432524107776.ingest.us.sentry.io/4510848267190272',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

EnvironmentHelper.init();

const checkForUpdates = async () => {
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (error) {
    console.log("Error checking for updates:", error);
  }
};

const App = () => {
  LogBox.ignoreLogs(['new NativeEventEmitter']);

  useEffect(() => {
    ErrorHelper.init();
    checkForUpdates();
  }, []);

  return <Navigator />

}
export default Sentry.wrap(App);