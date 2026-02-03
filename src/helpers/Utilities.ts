import analytics from '@react-native-firebase/analytics';
import { CachedData } from "./CachedData";

export class Utilities {

  static async trackEvent(name: string, data?: any) {
    try {
      const props: Record<string, any> = data ? { ...data } : {};
      if (CachedData.church?.name) props.church = CachedData.church.name;
      if (CachedData.room?.name) props.classRoom = CachedData.room.name;
      await analytics().logEvent(name, props);
    } catch {
      // Silently fail if analytics unavailable
    }
  }

}


