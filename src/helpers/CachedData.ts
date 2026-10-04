import AsyncStorage from "@react-native-async-storage/async-storage";
import { MessageFileInterface, CurrentPlan, ContentFolder } from "@churchapps/content-providers";
import RNFS from "react-native-fs";
import * as Sentry from "@sentry/react-native";
import { ProviderAuthHelper } from "./ProviderAuthHelper";

export class CachedData {
  static messageFiles: MessageFileInterface[];

  // Plan pairing data
  static providerId: string | null = null;
  static pairingData: unknown = null;
  static currentPlan: CurrentPlan | null = null;

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
  static providerSettings: Record<string, { libraryEnabled: boolean }> = {};

  static announcements: { providerId: string; folder: ContentFolder; files: MessageFileInterface[] } | null = null;

  // Focus memory: stores last focused item index per screen key
  static lastFocusedIndex: { [screenKey: string]: number } = {};

  // Clear focus memory for a specific screen or all screens matching a prefix
  static clearFocusMemory(screenKeyOrPrefix?: string) {
    if (!screenKeyOrPrefix) {
      this.lastFocusedIndex = {};
    } else {
      for (const key of Object.keys(this.lastFocusedIndex)) {
        if (key === screenKeyOrPrefix || key.startsWith(screenKeyOrPrefix + "_")) {
          delete this.lastFocusedIndex[key];
        }
      }
    }
  }

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
        level: "error"
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
        level: "error"
      });
    }
  }

  static async prefetch(
    files: MessageFileInterface[],
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
            level: "warning"
          });
        }
      }
      i++;
      this.cachedItems = i;
      changeCallback(this.cachedItems, this.totalCachableItems);
    }
  }

  static googleDriveFileId(url: string): string {
    try {
      const parsed = new URL(url);
      const fromQuery = parsed.searchParams.get("id");
      if (fromQuery && /^[\w-]+$/.test(fromQuery)) return fromQuery;
      const match = parsed.pathname.match(/\/files\/([\w-]+)/);
      return match?.[1] || "";
    } catch {
      return "";
    }
  }

  static isGoogleDriveUrl(url: string): boolean {
    if (!url || (!url.includes("drive.google.com") && !url.includes("googleapis.com/drive"))) return false;
    return !!this.googleDriveFileId(url);
  }

  // webContentLink needs a logged-in browser. The TV player has the OAuth token, so download alt=media with it.
  static googleDriveMediaUrl(url: string): string {
    const id = this.googleDriveFileId(url);
    if (!id) return url;
    return `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`;
  }

  static oneDriveItemId(url: string): string {
    const match = url?.match(/^https:\/\/graph\.microsoft\.com\/v1\.0\/me\/drive\/items\/([^/?]+)\/content/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  // Graph's /content 302s to a pre-signed URL that can reject a forwarded bearer header, so look up the short-lived downloadUrl and fetch it bare.
  private static async oneDriveDownloadUrl(url: string): Promise<string> {
    const auth = await ProviderAuthHelper.refreshIfNeeded("onedrive");
    if (!auth?.access_token) return url;
    try {
      const response = await fetch(url.replace(/\/content$/, ""), { headers: { Authorization: `Bearer ${auth.access_token}` } });
      const item = response.ok ? await response.json() : null;
      return item?.["@microsoft.graph.downloadUrl"] || url;
    } catch {
      return url;
    }
  }

  static needsRemoteSource(url: string): boolean {
    return this.isGoogleDriveUrl(url) || !!this.oneDriveItemId(url);
  }

  static async remoteSource(url: string): Promise<{ uri: string; headers?: Record<string, string> }> {
    if (this.isGoogleDriveUrl(url)) {
      const auth = await ProviderAuthHelper.getAuth("googledrive");
      return { uri: this.googleDriveMediaUrl(url), headers: auth?.access_token ? { Authorization: `Bearer ${auth.access_token}` } : undefined };
    }
    if (this.oneDriveItemId(url)) return { uri: await this.oneDriveDownloadUrl(url) };
    return { uri: url };
  }

  private static driveExtension(fileType?: string): string {
    if (fileType === "audio") return ".mp3";
    if (fileType === "image") return ".jpg";
    return ".mp4";
  }

  static getFilePath(url: string, fileType?: string) {
    if (!url) return "";
    const driveId = this.googleDriveFileId(url);
    if (driveId && (url.includes("drive.google.com") || url.includes("googleapis.com/drive"))) {
      return RNFS.CachesDirectoryPath + "/drive/" + driveId + this.driveExtension(fileType);
    }
    const oneDriveId = this.oneDriveItemId(url);
    if (oneDriveId) return RNFS.CachesDirectoryPath + "/onedrive/" + oneDriveId + this.driveExtension(fileType);
    const parts = url.split("?")[0].split("/");
    parts.splice(0, 3);
    let fullPath = RNFS.CachesDirectoryPath + "/" + parts.join("/");
    // External video URLs from lessons.church have no file extension (e.g. /externalVideos/download/9DgTnt_fXPu).
    // iOS AVFoundation needs a file extension to detect the media format, so append .mp4.
    const lastSegment = parts[parts.length - 1] || "";
    if (url.includes("externalVideos") && !/\.(mp4|mov|webm|m4v)$/i.test(lastSegment)) {
      fullPath += ".mp4";
    }
    return fullPath;
  }

  static async load(file: MessageFileInterface, fileProgressCallback?: (progress: number) => void) {
    if (!file.url) return;
    let fullPath = this.getFilePath(file.url, file.fileType);
    fullPath = decodeURIComponent(fullPath);
    const exists = await RNFS.exists(fullPath);
    if (!exists) {
      await this.download(file, fullPath, fileProgressCallback);
    }
  }

  private static async download(
    file: MessageFileInterface,
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

    const source = await this.remoteSource(file.url);

    const downloadResponse = RNFS.downloadFile({
      fromUrl: source.uri,
      headers: source.headers,
      toFile: diskPath,
      progress: (res) => {
        // Report current file progress as a ratio (0 to 1)
        if (res.contentLength > 0 && fileProgressCallback) {
          fileProgressCallback(res.bytesWritten / res.contentLength);
        }
      },
      progressDivider: 1 // Report progress frequently
    });

    const result = await downloadResponse.promise;
    if (result.statusCode !== 200) {
      throw new Error(`Download failed with status ${result.statusCode}`);
    }
  }

  static async allFilesCached(files: MessageFileInterface[]): Promise<boolean> {
    for (const f of files) {
      if (!f.url || f.url.trim() === "") continue;
      let fullPath = this.getFilePath(f.url, f.fileType);
      fullPath = decodeURIComponent(fullPath);
      if (!await RNFS.exists(fullPath)) return false;
    }
    return true;
  }

}
