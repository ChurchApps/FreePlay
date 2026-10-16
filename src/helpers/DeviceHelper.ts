import AsyncStorage from "@react-native-async-storage/async-storage";

export class DeviceHelper {
  private static DEVICE_ID_KEY = "freeplay_deviceId";
  private static DEVICE_SECRET_KEY = "freeplay_deviceSecret";

  public static async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem(this.DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = "fp_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
      await AsyncStorage.setItem(this.DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  public static async getSecret(): Promise<string> {
    return (await AsyncStorage.getItem(this.DEVICE_SECRET_KEY)) || "";
  }

  public static async setSecret(secret: string): Promise<void> {
    await AsyncStorage.setItem(this.DEVICE_SECRET_KEY, secret);
  }
}
