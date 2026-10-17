import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";
import { ContentFile, FreeShowProvider, networkInstanceToAuth } from "@churchapps/content-providers";
import { ScheduleItem, ScheduleManifest } from "../interfaces";
import { ApiHelper } from "./ApiHelper";
import { CachedData } from "./CachedData";
import { DeviceHelper } from "./DeviceHelper";
import { ProviderAuthHelper } from "./ProviderAuthHelper";
import { ScheduleClock } from "./ScheduleClock";
import { StorageManager } from "./StorageManager";
import { getProvider } from "../providers";

const MODE_KEY = "playMode";
const GROUP_KEY = "screenGroupId";
const MANIFEST_KEY = "scheduleManifest";
const PREFETCH_HOURS = 72;
const MIN_FREE_BYTES = 300 * 1024 * 1024;

const folder = () => RNFS.CachesDirectoryPath + "/schedule";

const extensionFor = (item: ScheduleItem) => {
  const fromUrl = (item.url || "").split("?")[0].match(/\.(mp4|mov|m4v|webm|mp3|m4a|jpe?g|png|gif|webp)$/i)?.[0];
  if (fromUrl) return fromUrl.toLowerCase();
  if (item.mediaType === "audio") return ".mp3";
  return item.mediaType === "image" ? ".jpg" : ".mp4";
};

let queue: Promise<unknown> = Promise.resolve();

export class ScheduleSync {
  static mode: "scheduled" | null = null;
  static screenGroupId: string | null = null;
  static manifest: ScheduleManifest | null = null;
  static lastChecked = 0;
  static missing: string[] = [];
  static nowPlaying: { occurrenceId: string | null; cacheKey: string; title: string } | null = null;
  // Files of a teacher paced lesson still on screen past its end time; kept out of eviction until it lets go.
  static holding: ScheduleItem[] = [];
  private static cached = new Set<string>();
  private static listeners = new Set<() => void>();

  static isScheduled() {
    return this.mode === "scheduled";
  }

  static subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private static emit() {
    this.listeners.forEach(l => l());
  }

  static localPath(item: ScheduleItem) {
    return folder() + "/" + item.cacheKey.replace(/[^\w-]/g, "_") + extensionFor(item);
  }

  static isCached(cacheKey: string) {
    return this.cached.has(cacheKey);
  }

  static allItems(manifest: ScheduleManifest | null = this.manifest): ScheduleItem[] {
    if (!manifest) return [];
    const now = Date.now();
    const horizon = now + PREFETCH_HOURS * 3600 * 1000;
    const upcoming = (manifest.occurrences || []).filter(o => Date.parse(o.end) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const soon = upcoming.filter(o => Date.parse(o.start) < horizon);
    const later = upcoming.filter(o => Date.parse(o.start) >= horizon);
    const ordered = [...(manifest.fallback || []), ...soon.flatMap(o => o.items || []), ...later.flatMap(o => o.items || [])];
    const seen = new Set<string>();
    return ordered.filter(i => !seen.has(i.cacheKey) && seen.add(i.cacheKey));
  }

  static async load(): Promise<void> {
    this.mode = await CachedData.getAsyncStorage(MODE_KEY);
    this.screenGroupId = await CachedData.getAsyncStorage(GROUP_KEY);
    this.manifest = await CachedData.getAsyncStorage(MANIFEST_KEY);
    for (const item of this.allItems()) {
      if (await RNFS.exists(this.localPath(item))) this.cached.add(item.cacheKey);
    }
  }

  static async setPaired(screenGroupId: string): Promise<void> {
    this.mode = "scheduled";
    this.screenGroupId = screenGroupId;
    await CachedData.setAsyncStorage(MODE_KEY, this.mode);
    await CachedData.setAsyncStorage(GROUP_KEY, screenGroupId);
    this.emit();
  }

  static async unpair(): Promise<void> {
    this.mode = null;
    this.screenGroupId = null;
    this.manifest = null;
    await AsyncStorage.multiRemove([MODE_KEY, GROUP_KEY, MANIFEST_KEY]);
    await this.evict([]);
    this.emit();
  }

  static sync(): Promise<void> {
    if (!this.isScheduled()) return Promise.resolve();
    const run = queue.then(() => this.runSync());
    queue = run;
    return run;
  }

  private static async runSync(): Promise<void> {
    const deviceId = await DeviceHelper.getDeviceId();
    const headers = { "x-device-secret": await DeviceHelper.getSecret() };
    try {
      const manifest: ScheduleManifest = await ApiHelper.getAnonymous(`/screens/manifest/${deviceId}`, "DoingApi", headers);
      this.lastChecked = Date.now();
      if (manifest && manifest.rev !== this.manifest?.rev) {
        this.manifest = manifest;
        await CachedData.setAsyncStorage(MANIFEST_KEY, manifest);
        this.emit();
      }
    } catch (err) {
      console.log("[ScheduleSync] manifest fetch failed:", err?.message);
      if (await this.wasUnpaired(deviceId)) return this.unpair();
    }

    const items = this.allItems();
    if (items.some(i => !this.cached.has(i.cacheKey))) await this.downloadAll(items);
    await this.evict(items.concat(this.holding));
    this.missing = items.filter(i => !this.cached.has(i.cacheKey)).map(i => i.cacheKey);
    this.emit();
    await this.postStatus(deviceId, headers);
  }

  private static async wasUnpaired(deviceId: string): Promise<boolean> {
    try {
      const status = await ApiHelper.getAnonymous(`/devices/status/${deviceId}`, "MessagingApi");
      return !!status && (!status.paired || status.contentType !== "freeplayScreen");
    } catch {
      return false;
    }
  }

  private static async downloadAll(items: ScheduleItem[]) {
    if (!await RNFS.exists(folder())) await RNFS.mkdir(folder()).catch(() => {});
    const lanPlaylists = new Map<string, Promise<ContentFile[]>>();
    for (const item of items) {
      if (this.cached.has(item.cacheKey)) continue;
      if (await StorageManager.getFreeBytes() < MIN_FREE_BYTES) {
        await StorageManager.ensureFreeSpace();
        if (await StorageManager.getFreeBytes() < MIN_FREE_BYTES) return;
      }
      const target = this.localPath(item);
      const part = target + ".part";
      try {
        const url = item.resolve === "lan" ? await this.lanUrl(item, lanPlaylists) : item.url;
        if (!url) throw new Error("No url for " + item.cacheKey);
        if (item.headers) {
          const result = await RNFS.downloadFile({ fromUrl: url, headers: item.headers, toFile: part }).promise;
          if (result.statusCode !== 200) throw new Error(`Download failed with status ${result.statusCode}`);
        } else {
          await CachedData.download({ url, fileType: item.mediaType }, part);
        }
        await RNFS.moveFile(part, target);
        this.cached.add(item.cacheKey);
        this.emit();
      } catch (err) {
        console.log("[ScheduleSync] download failed:", item.cacheKey, err?.message);
        await RNFS.unlink(part).catch(() => {});
      }
    }
  }

  private static async lanUrl(item: ScheduleItem, playlists: Map<string, Promise<ContentFile[]>>): Promise<string> {
    const provider = getProvider(item.providerId || "freeshow") as FreeShowProvider | null;
    if (!provider?.getPlaylist || !item.providerPath) return "";
    if (!playlists.has(item.providerPath)) {
      playlists.set(item.providerPath, (async () => {
        let auth = await ProviderAuthHelper.refreshIfNeeded(provider.id);
        if (!auth && provider.discoverInstances) {
          const [instance] = await provider.discoverInstances();
          if (instance) auth = networkInstanceToAuth(instance);
        }
        return (await provider.getPlaylist(item.providerPath, auth)) || [];
      })());
    }
    const files = await playlists.get(item.providerPath);
    const match = files.find(f => item.fileId && f.id === item.fileId) || files.find(f => f.title === item.title) || (files.length === 1 ? files[0] : null);
    return match?.url || "";
  }

  private static async evict(keep: ScheduleItem[]) {
    const keys = new Set(keep.map(i => i.cacheKey));
    this.cached.forEach(key => { if (!keys.has(key)) this.cached.delete(key); });
    if (!await RNFS.exists(folder())) return;
    const names = new Set(keep.map(i => this.localPath(i).split("/").pop()));
    for (const entry of await RNFS.readDir(folder())) {
      if (!names.has(entry.name)) await RNFS.unlink(entry.path).catch(() => {});
    }
  }

  private static async postStatus(deviceId: string, headers: Record<string, string>) {
    const free = await StorageManager.getFreeBytes();
    const body = {
      manifestRev: this.manifest?.rev ?? null,
      readyThrough: ScheduleClock.readyThrough(this.manifest, k => this.cached.has(k), Date.now()),
      missing: this.missing,
      freeBytes: Number.isFinite(free) ? free : null,
      nowPlaying: this.nowPlaying,
      appVersion: require("../../package.json").version
    };
    try {
      await ApiHelper.post(`/screens/status/${deviceId}`, body, "DoingApi", headers);
    } catch (err) {
      console.log("[ScheduleSync] status post failed:", err?.message);
    }
  }
}
