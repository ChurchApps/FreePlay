import SoundPlayer from "react-native-sound-player";

export class SoundHelper {
  // Play a subtle click sound for TV button feedback
  // Requires "click.mp3" to be placed in android/app/src/main/res/raw/ and ios resources
  static playClick() {
    try {
      SoundPlayer.playSoundFile("click", "wav");
    } catch {
      // Sound file may not exist yet — fail silently
    }
  }
}
