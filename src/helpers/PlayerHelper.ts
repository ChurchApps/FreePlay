

import { MessageFileInterface } from "../interfaces";

export class PlayerHelper {
  static timer: NodeJS.Timeout = null;
  static pendingPause: boolean = false;

  static isVideoFile(file: MessageFileInterface): boolean {
    if (!file || !file.url) return false;
    if (file.fileType === "video" || file.fileType === "audio") return true;
    const parts = file.url.split("?")[0].split(".");
    const ext = parts[parts.length - 1].toLowerCase();
    return ext === "webm" || ext === "mp4" || file.url.includes("externalVideos") || file.url.includes("stream.mux.com");
  }

  // 0 means wait for the video's onEnd instead of a timer.
  static slideSeconds(file: MessageFileInterface): number {
    if (!file) return 0;
    if (file.seconds && file.seconds > 0) return file.seconds;
    return this.isVideoFile(file) ? 0 : 5;
  }

}
