export {
  getProvider,
  getAllProviders,
  registerProvider,
  getProviderConfig,
  getAvailableProviders,
  type IProvider
} from "@churchapps/content-providers";

/** Provider IDs shown in the FreePlay app. Used by both SplashScreen and ProvidersScreen. */
export const FREEPLAY_PROVIDER_IDS = [
  "signpresenter",
  "lessonschurch",
  "b1church",
  "bibleproject",
  "dropbox",
  "jesusfilm"
];
