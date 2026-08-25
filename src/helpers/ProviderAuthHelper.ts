import AsyncStorage from "@react-native-async-storage/async-storage";
import { ContentProviderAuthData, getProvider, TokenHelper } from "@churchapps/content-providers";

const tokenHelper = new TokenHelper();

const AUTH_KEY_PREFIX = "provider_auth_";

export function authIsExpired(auth: ContentProviderAuthData | null | undefined, nowMs: number = Date.now()): boolean {
  if (!auth?.created_at || !auth.expires_in) return true;
  const lifetimeMs = auth.expires_in * 1000;
  const expiresAt = (auth.created_at + auth.expires_in) * 1000;
  const bufferMs = Math.min(5 * 60 * 1000, Math.floor(lifetimeMs / 10));
  return nowMs > expiresAt - bufferMs;
}

export class ProviderAuthHelper {
  private static refreshInflight = new Map<string, Promise<ContentProviderAuthData | null>>();

  static async getAuth(providerId: string): Promise<ContentProviderAuthData | null> {
    try {
      const key = AUTH_KEY_PREFIX + providerId;
      const data = await AsyncStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data) as ContentProviderAuthData;
    } catch (error) {
      console.error(`Error getting auth for provider ${providerId}:`, error);
      return null;
    }
  }

  static async setAuth(providerId: string, auth: ContentProviderAuthData): Promise<void> {
    try {
      const key = AUTH_KEY_PREFIX + providerId;
      await AsyncStorage.setItem(key, JSON.stringify(auth));
    } catch (error) {
      console.error(`Error setting auth for provider ${providerId}:`, error);
    }
  }

  static async clearAuth(providerId: string): Promise<void> {
    try {
      const key = AUTH_KEY_PREFIX + providerId;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error clearing auth for provider ${providerId}:`, error);
    }
  }

  private static CONNECTION_STATE_KEY = "provider_connection_states";

  static async setConnectionState(providerId: string, connected: boolean): Promise<void> {
    try {
      const states = await this.getConnectionStates();
      states[providerId] = connected;
      await AsyncStorage.setItem(this.CONNECTION_STATE_KEY, JSON.stringify(states));
    } catch (error) {
      console.error(`Error setting connection state for provider ${providerId}:`, error);
    }
  }

  static async getConnectionStates(): Promise<Record<string, boolean>> {
    try {
      const data = await AsyncStorage.getItem(this.CONNECTION_STATE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Error getting connection states:", error);
      return {};
    }
  }

  static async isConnected(providerId: string): Promise<boolean> {
    const provider = getProvider(providerId);
    if (!provider) return false;

    const states = await this.getConnectionStates();
    if (states[providerId] === false) return false;

    if (!provider.requiresAuth) {
      return states[providerId] === true;
    }

    const auth = await this.getAuth(providerId);
    if (!auth) return false;
    if (!authIsExpired(auth)) return true;

    const refreshed = await this.refreshIfNeeded(providerId);
    if (refreshed && !authIsExpired(refreshed)) return true;
    return states[providerId] === true;
  }

  static async refreshIfNeeded(providerId: string): Promise<ContentProviderAuthData | null> {
    const existing = ProviderAuthHelper.refreshInflight.get(providerId);
    if (existing) return existing;
    const pending = this.doRefreshIfNeeded(providerId).finally(() => { ProviderAuthHelper.refreshInflight.delete(providerId); });
    ProviderAuthHelper.refreshInflight.set(providerId, pending);
    return pending;
  }

  private static async doRefreshIfNeeded(providerId: string): Promise<ContentProviderAuthData | null> {
    const provider = getProvider(providerId);
    if (!provider) return null;

    const auth = await this.getAuth(providerId);
    if (!auth) return null;
    if (!authIsExpired(auth)) return auth;

    const newAuth = await tokenHelper.refreshToken(provider.config, auth);
    if (newAuth) {
      await this.setAuth(providerId, newAuth);
      return newAuth;
    }

    const latest = await this.getAuth(providerId);
    if (latest && latest.refresh_token !== auth.refresh_token && !authIsExpired(latest)) return latest;
    return null;
  }
}
