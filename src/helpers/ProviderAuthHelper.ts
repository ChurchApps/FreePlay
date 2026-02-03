import AsyncStorage from '@react-native-async-storage/async-storage';
import { ContentProviderAuthData, getProvider, TokenHelper } from '@churchapps/content-provider-helper';

const tokenHelper = new TokenHelper();

const AUTH_KEY_PREFIX = 'provider_auth_';

export class ProviderAuthHelper {
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

  static async isConnected(providerId: string): Promise<boolean> {
    const provider = getProvider(providerId);
    if (!provider) return false;

    // If provider doesn't require auth, it's always "connected"
    if (!provider.requiresAuth) return true;

    const auth = await this.getAuth(providerId);
    if (!auth) return false;

    return tokenHelper.isAuthValid(auth);
  }

  static async refreshIfNeeded(providerId: string): Promise<ContentProviderAuthData | null> {
    const provider = getProvider(providerId);
    if (!provider) return null;

    const auth = await this.getAuth(providerId);
    if (!auth) return null;

    // If token is still valid, return it
    if (tokenHelper.isAuthValid(auth)) return auth;

    // Try to refresh
    const newAuth = await tokenHelper.refreshToken(provider.config, auth);
    if (newAuth) {
      await this.setAuth(providerId, newAuth);
      return newAuth;
    }

    return null;
  }
}
