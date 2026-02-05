import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChurchInterface, ClassroomInterface, LessonPlaylistFileInterface, PlanInterface, FeedVenueInterface } from "../interfaces";
import RNFS from "react-native-fs";
import * as Sentry from "@sentry/react-native";

export class CachedData {
  static church: ChurchInterface;
  static room: ClassroomInterface;
  static messageFiles: LessonPlaylistFileInterface[];

  // Plan pairing data
  static planTypeId: string | null = null;
  static pairedChurchId: string | null = null;
  static currentPlan: PlanInterface | null = null;
  static planVenue: FeedVenueInterface | null = null;

  static totalCachableItems: number = 0;
  static cachedItems: number = 0;
  static cachePath = RNFS.CachesDirectoryPath;

  // Byte-level progress tracking
  static totalBytes: number = 0;
  static downloadedBytes: number = 0;

  static navExpanded = false;
  static currentScreen = "";
  static preventSidebarExpand = false;
  static resolution: "720" | "1080" = "720";

  // Content provider state
  static connectedProviders: string[] = [];
  static activeProvider: string | null = null;

  // Focus memory: stores last focused item index per screen key
  static lastFocusedIndex: { [screenKey: string]: number } = {};

  // Track active downloads for cleanup
  private static activeDownloads: Map<string, { jobId: number }> = new Map();

  static async getAsyncStorage(key: string) {
    try {
      const json = await AsyncStorage.getItem(key);
      if (json) return JSON.parse(json);
      return null;
    } catch (error) {
      console.error(`Failed to get AsyncStorage key "${key}":`, error);
      Sentry.addBreadcrumb({
        category: "storage",
        message: `Failed to get AsyncStorage key: ${key}`,
        level: "error",
      });
      return null;
    }
  }

  static async setAsyncStorage(key: string, obj: any) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(obj));
    } catch (error) {
      console.error(`Failed to set AsyncStorage key "${key}":`, error);
      Sentry.addBreadcrumb({
        category: "storage",
        message: `Failed to set AsyncStorage key: ${key}`,
        level: "error",
      });
    }
  }

  static async prefetch(
    files: LessonPlaylistFileInterface[],
    changeCallback: (cached: number, total: number) => void,
    fileProgressCallback?: (progress: number) => void
  ) {
    this.cachedItems = 0;
    this.downloadedBytes = 0;
    this.totalBytes = 0;
    let i = 0;
    this.totalCachableItems = files.length;
    changeCallback(this.cachedItems, this.totalCachableItems);

    for (const f of files) {
      try {
        // Reset file progress at start of each file
        if (fileProgressCallback) fileProgressCallback(0);

        // Skip files with invalid URLs
        if (!f.url || f.url.trim() === "") {
          console.log("Skipping file with empty URL");
          i++;
          this.cachedItems = i;
          changeCallback(this.cachedItems, this.totalCachableItems);
          continue;
        }
        await this.load(f, fileProgressCallback);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log("Download Failed: " + errorMessage);

        // Only log non-abort errors to Sentry (aborts are expected during navigation)
        if (!errorMessage.includes("abort") && !errorMessage.includes("cancelled")) {
          Sentry.addBreadcrumb({
            category: "download",
            message: `Download failed for ${f.url}: ${errorMessage}`,
            level: "warning",
          });
        }
      }
      i++;
      this.cachedItems = i;
      changeCallback(this.cachedItems, this.totalCachableItems);
    }
  }

  static getFilePath(url: string) {
    if (!url) return "";
    const parts = url.split("?")[0].split("/");
    parts.splice(0, 3);
    const fullPath = RNFS.CachesDirectoryPath + "/" + parts.join("/");
    return fullPath;
  }

  static async load(file: LessonPlaylistFileInterface, fileProgressCallback?: (progress: number) => void) {
    if (!file.url) return;
    let fullPath = this.getFilePath(file.url);
    fullPath = decodeURIComponent(fullPath);
    if (!await RNFS.exists(fullPath)) await this.download(file, fullPath, fileProgressCallback);
  }

  private static async download(
    file: LessonPlaylistFileInterface,
    diskPath: string,
    fileProgressCallback?: (progress: number) => void
  ) {
    if (!file.url) {
      throw new Error("Cannot download file with empty URL");
    }

    const idx = diskPath.lastIndexOf("/");
    const folder = diskPath.substring(0, idx);

    try {
      if (!await RNFS.exists(folder)) await RNFS.mkdir(folder);
    } catch (mkdirError) {
      // Directory might already exist or be created by another download
      console.log("mkdir warning:", mkdirError);
    }

    const downloadResponse = RNFS.downloadFile({
      fromUrl: file.url,
      toFile: diskPath,
      progress: (res) => {
        // Report current file progress as a ratio (0 to 1)
        if (res.contentLength > 0 && fileProgressCallback) {
          fileProgressCallback(res.bytesWritten / res.contentLength);
        }
      },
      progressDivider: 1, // Report progress frequently
    });

    // Track the download so it can be cancelled if needed
    this.activeDownloads.set(file.url, { jobId: downloadResponse.jobId });

    try {
      const result = await downloadResponse.promise;
      // Check if download was successful
      if (result.statusCode !== 200) {
        throw new Error(`Download failed with status ${result.statusCode}`);
      }
    } finally {
      // Clean up tracking
      this.activeDownloads.delete(file.url);
    }
  }

  // Cancel all active downloads (useful when navigating away)
  static cancelAllDownloads() {
    this.activeDownloads.forEach((download, url) => {
      try {
        RNFS.stopDownload(download.jobId);
        console.log("Cancelled download:", url);
      } catch (e) {
        // Ignore errors when cancelling
      }
    });
    this.activeDownloads.clear();
  }

}
