import RNFS from "react-native-fs";
import { DownloadedItemInterface } from "../interfaces";
import { CachedData } from "./CachedData";

export class DownloadIndex {
  private static STORAGE_KEY = "downloadIndex";

  static async getAll(): Promise<DownloadedItemInterface[]> {
    const data = await CachedData.getAsyncStorage(this.STORAGE_KEY);
    if (!data || !Array.isArray(data)) return [];
    return data;
  }

  private static async saveAll(entries: DownloadedItemInterface[]): Promise<void> {
    await CachedData.setAsyncStorage(this.STORAGE_KEY, entries);
  }

  static async replaceAll(entries: DownloadedItemInterface[]): Promise<void> {
    await this.saveAll(entries);
  }

  static async addEntry(entry: DownloadedItemInterface): Promise<void> {
    const entries = await this.getAll();
    const stamped: DownloadedItemInterface = {
      ...entry,
      lastAccessedAt: entry.lastAccessedAt ?? entry.downloadedAt
    };
    const idx = entries.findIndex(e => e.downloadKey === stamped.downloadKey);
    if (idx >= 0) {
      entries[idx] = stamped;
    } else {
      entries.unshift(stamped);
    }
    await this.saveAll(entries);
  }

  static async removeEntry(downloadKey: string): Promise<void> {
    const entries = await this.getAll();
    const filtered = entries.filter(e => e.downloadKey !== downloadKey);
    await this.saveAll(filtered);
  }

  static async verifyFiles(entry: DownloadedItemInterface): Promise<boolean> {
    for (const f of entry.messageFiles) {
      if (!f.url || f.url.trim() === "") continue;
      const fullPath = decodeURIComponent(CachedData.getFilePath(f.url));
      if (!await RNFS.exists(fullPath)) return false;
    }
    return true;
  }

  static async getVerifiedEntries(prune?: boolean): Promise<DownloadedItemInterface[]> {
    const entries = await this.getAll();
    const verified: DownloadedItemInterface[] = [];
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

  static async deleteFiles(entry: DownloadedItemInterface): Promise<number> {
    let bytesReclaimed = 0;
    for (const f of entry.messageFiles) {
      if (!f.url || f.url.trim() === "") continue;
      const fullPath = decodeURIComponent(CachedData.getFilePath(f.url));
      try {
        const stat = await RNFS.stat(fullPath);
        bytesReclaimed += Number(stat.size) || 0;
        await RNFS.unlink(fullPath);
      } catch (e) {
        // File may already be missing; ignore.
      }
    }
    return bytesReclaimed;
  }

  static generateKey(source: string, ids: Record<string, string>): string {
    const parts = Object.values(ids).filter(v => v);
    return source + ":" + parts.join(":");
  }
}
