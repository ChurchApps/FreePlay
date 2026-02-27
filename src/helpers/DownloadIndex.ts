import RNFS from "react-native-fs";
import { DownloadedLessonInterface } from "../interfaces";
import { CachedData } from "./CachedData";

export class DownloadIndex {
  private static STORAGE_KEY = "downloadIndex";

  static async getAll(): Promise<DownloadedLessonInterface[]> {
    const data = await CachedData.getAsyncStorage(this.STORAGE_KEY);
    if (!data || !Array.isArray(data)) return [];
    return data;
  }

  private static async saveAll(entries: DownloadedLessonInterface[]): Promise<void> {
    await CachedData.setAsyncStorage(this.STORAGE_KEY, entries);
  }

  static async addEntry(entry: DownloadedLessonInterface): Promise<void> {
    const entries = await this.getAll();
    const idx = entries.findIndex(e => e.downloadKey === entry.downloadKey);
    if (idx >= 0) {
      entries[idx] = entry;
    } else {
      entries.unshift(entry);
    }
    await this.saveAll(entries);
  }

  static async removeEntry(downloadKey: string): Promise<void> {
    const entries = await this.getAll();
    const filtered = entries.filter(e => e.downloadKey !== downloadKey);
    await this.saveAll(filtered);
  }

  static async verifyFiles(entry: DownloadedLessonInterface): Promise<boolean> {
    for (const f of entry.messageFiles) {
      if (!f.url || f.url.trim() === "") continue;
      const fullPath = decodeURIComponent(CachedData.getFilePath(f.url));
      if (!await RNFS.exists(fullPath)) return false;
    }
    return true;
  }

  static async getVerifiedEntries(prune?: boolean): Promise<DownloadedLessonInterface[]> {
    const entries = await this.getAll();
    const verified: DownloadedLessonInterface[] = [];
    const toRemove: string[] = [];

    for (const entry of entries) {
      if (await this.verifyFiles(entry)) {
        verified.push(entry);
      } else {
        toRemove.push(entry.downloadKey);
      }
    }

    if (prune && toRemove.length > 0) {
      const remaining = entries.filter(e => !toRemove.includes(e.downloadKey));
      await this.saveAll(remaining);
    }

    return verified;
  }

  static async deleteFiles(entry: DownloadedLessonInterface): Promise<void> {
    for (const f of entry.messageFiles) {
      if (!f.url || f.url.trim() === "") continue;
      const fullPath = decodeURIComponent(CachedData.getFilePath(f.url));
      try {
        if (await RNFS.exists(fullPath)) {
          await RNFS.unlink(fullPath);
        }
      } catch (e) {
        console.log("Failed to delete file:", fullPath, e);
      }
    }
  }

  static generateKey(source: string, ids: Record<string, string>): string {
    const parts = Object.values(ids).filter(v => v);
    return source + ":" + parts.join(":");
  }
}
