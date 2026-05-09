import analytics from "@react-native-firebase/analytics";
import { CachedData } from "./CachedData";

export class Utilities {

  static async trackEvent(name: string, data?: any) {
    try {
      const props: Record<string, any> = data ? { ...data } : {};
      if (CachedData.activeProvider) props.provider = CachedData.activeProvider;
      await analytics().logEvent(name, props);
    } catch {
      // Silently fail if analytics unavailable
    }
  }

}


