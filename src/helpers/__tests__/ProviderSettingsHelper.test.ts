import AsyncStorage from "@react-native-async-storage/async-storage";
import { CachedData } from "../CachedData";
import { ProviderSettingsHelper } from "../ProviderSettingsHelper";
import { PlanSync } from "../PlanSync";

jest.mock("../PlanSync", () => ({ PlanSync: { syncCurrentPlan: jest.fn() } }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  CachedData.providerSettings = {};
  CachedData.providerId = null;
  CachedData.currentPlan = null;
  CachedData.messageFiles = [];
});

describe("library enabled", () => {
  it("defaults to true for unknown providers", () => {
    expect(ProviderSettingsHelper.getLibraryEnabledSync("p1")).toBe(true);
  });

  it("persists a disabled flag and reloads it", async () => {
    await ProviderSettingsHelper.setLibraryEnabled("p1", false);
    expect(ProviderSettingsHelper.getLibraryEnabledSync("p1")).toBe(false);
    CachedData.providerSettings = {};
    expect(await ProviderSettingsHelper.getLibraryEnabled("p1")).toBe(false);
  });

  it("clearSettings restores the default", async () => {
    await ProviderSettingsHelper.setLibraryEnabled("p1", false);
    await ProviderSettingsHelper.clearSettings("p1");
    expect(ProviderSettingsHelper.getLibraryEnabledSync("p1")).toBe(true);
  });

  it("loadAll tolerates corrupt storage", async () => {
    await AsyncStorage.setItem("provider_settings", "{bad");
    expect(await ProviderSettingsHelper.loadAll()).toEqual({});
  });
});

describe("auto-download", () => {
  it("enabling sets the active plan provider and kicks off a sync", async () => {
    await ProviderSettingsHelper.setAutoDownloadEnabled("p1", true);
    expect(CachedData.providerId).toBe("p1");
    expect(await CachedData.getAsyncStorage("providerId")).toBe("p1");
    expect(PlanSync.syncCurrentPlan).toHaveBeenCalled();
    expect(ProviderSettingsHelper.isAutoDownloadEnabled("p1")).toBe(true);
  });

  it("disabling clears plan state only for the active provider", async () => {
    await ProviderSettingsHelper.setAutoDownloadEnabled("p1", true);
    await ProviderSettingsHelper.setAutoDownloadEnabled("p2", false);
    expect(CachedData.providerId).toBe("p1");
    await ProviderSettingsHelper.setAutoDownloadEnabled("p1", false);
    expect(CachedData.providerId).toBeNull();
    expect(CachedData.currentPlan).toBeNull();
    expect(await AsyncStorage.getItem("providerId")).toBeNull();
  });
});
