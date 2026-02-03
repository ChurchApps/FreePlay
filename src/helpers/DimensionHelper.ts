import { Dimensions, ScaledSize } from "react-native";

let { width, height } = Dimensions.get("window");
let orientationChangeCallback: (() => void) | null = null;

const dimensionChangeHandler = ({ window }: { window: ScaledSize }) => {
  width = window.width;
  height = window.height;
  if (orientationChangeCallback) {
    orientationChangeCallback();
  }
};

export class DimensionHelper {
  static wp(percentage: string): number {
    const value = parseFloat(percentage);
    return (width * value) / 100;
  }

  static hp(percentage: string): number {
    const value = parseFloat(percentage);
    return (height * value) / 100;
  }

  static listenOrientationChange(_context: any, callback: () => void): void {
    orientationChangeCallback = callback;
    Dimensions.addEventListener("change", dimensionChangeHandler);
  }

  static removeOrientationListener(): void {
    orientationChangeCallback = null;
    // Note: In newer React Native, removeEventListener is deprecated
    // The subscription is automatically cleaned up
  }
}
