import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";
import { ContentFile, ContentFolder, MessageFileInterface } from "../interfaces";
import { CachedData } from "./CachedData";
import { ProviderAuthHelper } from "./ProviderAuthHelper";
import { getProvider } from "../providers";

const STORAGE_KEY = "announcements";
const DEFAULT_SECONDS = 15;

let queue: Promise<unknown> = Promise.resolve();

const localPath = (f: MessageFileInterface) => decodeURIComponent(CachedData.getFilePath(f.url || "", f.fileType));

const toSlides = (files: ContentFile[]): MessageFileInterface[] => files.map(f => ({
  id: f.id,
  name: f.title,
  url: f.url,
  fileType: f.mediaType,
  // Videos without an assigned duration play to the end instead of being cut at 15s
  seconds: f.seconds && f.seconds > 0 ? f.seconds : (f.mediaType === "video" ? undefined : DEFAULT_SECONDS),
  loop: true,
  // The player can't advance from a lone slide back to itself, so a single video repeats in place
  loopVideo: files.length === 1,
  image: f.thumbnail
}));

export class AnnouncementsHelper {
  static async load(): Promise<void> {
    CachedData.announcements = await CachedData.getAsyncStorage(STORAGE_KEY);
  }

  static async setFolder(providerId: string, folder: ContentFolder): Promise<boolean> {
    // Old slides stay until the new folder is downloaded; sync() then removes the ones no longer used
    CachedData.announcements = { providerId, folder, files: CachedData.announcements?.files || [] };
    await CachedData.setAsyncStorage(STORAGE_KEY, CachedData.announcements);
    return this.sync();
  }

  static async clear(): Promise<void> {
    const files = CachedData.announcements?.files || [];
    CachedData.announcements = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    for (const f of files) await RNFS.unlink(localPath(f)).catch(() => {});
  }

  /** Re-read the announcements folder, download new slides and drop removed ones. Resolves false if nothing was updated. */
  static sync(): Promise<boolean> {
    const run = queue.then(() => this.runSync());
    queue = run;
    return run;
  }

  private static async runSync(): Promise<boolean> {
    const config = CachedData.announcements;
    if (!config) return false;
    const provider = getProvider(config.providerId);
    if (!provider) return false;

    try {
      const auth = await ProviderAuthHelper.refreshIfNeeded(config.providerId);
      const { folder } = config;
      const items = folder.isLeaf && provider.getPlaylist
        ? await provider.getPlaylist(folder.path, auth)
        : await provider.browse(folder.path, auth);
      const slides = toSlides((items || []).filter((i): i is ContentFile => i.type === "file"));
      // ponytail: providers return [] when offline, so an empty listing keeps the current slides — turn announcements off in settings to remove them
      if (slides.length === 0) return false;

      const files: MessageFileInterface[] = [];
      for (const f of slides) {
        try {
          await CachedData.load(f);
          files.push(f);
        } catch (e) {
          console.log("[Announcements] download failed:", f.url, e);
        }
      }
      if (files.length === 0 || CachedData.announcements !== config) return false;

      // ponytail: a slide replaced under the same URL/file id is not re-downloaded — needs a modified date from providers to detect
      const keep = new Set(files.map(localPath));
      for (const old of config.files) {
        if (!keep.has(localPath(old))) await RNFS.unlink(localPath(old)).catch(() => {});
      }

      CachedData.announcements = { ...config, files };
      await CachedData.setAsyncStorage(STORAGE_KEY, CachedData.announcements);
      return true;
    } catch (err) {
      console.error("[Announcements] sync failed:", err);
      return false;
    }
  }
}
