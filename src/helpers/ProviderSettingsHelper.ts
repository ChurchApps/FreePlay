import AsyncStorage from "@react-native-async-storage/async-storage";
import { CachedData } from "./CachedData";
import { PlanSync } from "./PlanSync";

const SETTINGS_KEY = "provider_settings";

export type ProviderSettings = { libraryEnabled: boolean };

export class ProviderSettingsHelper {
  static async loadAll(): Promise<Record<string, ProviderSettings>> {
    try {
      const data = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = data ? (JSON.parse(data) as Record<string, ProviderSettings>) : {};
      CachedData.providerSettings = settings;
      return settings;
    } catch (error) {
      console.error("Error loading provider settings:", error);
      CachedData.providerSettings = {};
      return {};
    }
  }

  private static async persist(settings: Record<string, ProviderSettings>) {
    CachedData.providerSettings = settings;
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  static getLibraryEnabledSync(providerId: string): boolean {
    const entry = CachedData.providerSettings[providerId];
    if (!entry) return true;
    return entry.libraryEnabled !== false;
  }

  static async getLibraryEnabled(providerId: string): Promise<boolean> {
    if (Object.keys(CachedData.providerSettings).length === 0) {
      await this.loadAll();
    }
    return this.getLibraryEnabledSync(providerId);
  }

  static async setLibraryEnabled(providerId: string, enabled: boolean): Promise<void> {
    try {
      const settings = { ...CachedData.providerSettings };
      settings[providerId] = { ...(settings[providerId] || { libraryEnabled: true }), libraryEnabled: enabled };
      await this.persist(settings);
    } catch (error) {
      console.error(`Error setting library enabled for ${providerId}:`, error);
    }
  }

  static async clearSettings(providerId: string): Promise<void> {
    try {
      const settings = { ...CachedData.providerSettings };
      delete settings[providerId];
      await this.persist(settings);
    } catch (error) {
      console.error(`Error clearing settings for ${providerId}:`, error);
    }
  }

  static isAutoDownloadEnabled(providerId: string): boolean {
    return CachedData.providerId === providerId;
  }

  static async setAutoDownloadEnabled(providerId: string, enabled: boolean): Promise<void> {
    if (enabled) {
      CachedData.providerId = providerId;
      await CachedData.setAsyncStorage("providerId", providerId);
      PlanSync.syncCurrentPlan();
    } else if (CachedData.providerId === providerId) {
      CachedData.providerId = null;
      CachedData.currentPlan = null;
      CachedData.messageFiles = [];
      await AsyncStorage.removeItem("providerId");
      await AsyncStorage.removeItem("currentPlan");
      await AsyncStorage.removeItem("messageFiles");
    }
  }
}
