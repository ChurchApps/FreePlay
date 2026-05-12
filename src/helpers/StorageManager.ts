import RNFS from "react-native-fs";
import * as Sentry from "@sentry/react-native";
import { DownloadedItemInterface } from "../interfaces";
import { DownloadIndex } from "./DownloadIndex";

const MB = 1024 * 1024;
const LOW_SPACE_THRESHOLD_BYTES = 500 * MB;
const EVICTION_TARGET_BYTES = 1024 * MB;

export class StorageManager {
  static async getFreeBytes(): Promise<number> {
    try {
      const info = await RNFS.getFSInfo();
      return info.freeSpace;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  static async touchEntry(downloadKey: string): Promise<void> {
    const entries = await DownloadIndex.getAll();
    const entry = entries.find(e => e.downloadKey === downloadKey);
    if (!entry) return;
    entry.lastAccessedAt = Date.now();
    await DownloadIndex.replaceAll(entries);
  }

  // Evict least-recently-used downloaded items until free space meets the target,
  // or only protected entries remain. Lessons are evicted as atomic units.
  static async ensureFreeSpace(protectedKeys: string[] = []): Promise<void> {
    const free = await this.getFreeBytes();
    if (free >= LOW_SPACE_THRESHOLD_BYTES) return;

    const entries = await DownloadIndex.getAll();
    const protectedSet = new Set(protectedKeys.filter(Boolean));
    const candidates = entries
      .filter(e => !protectedSet.has(e.downloadKey))
      .sort((a, b) => this.accessTime(a) - this.accessTime(b));

    if (candidates.length === 0) {
      Sentry.addBreadcrumb({
        category: "storage",
        message: `Low space (${Math.round(free / MB)} MB free) but no evictable entries`,
        level: "warning"
      });
      return;
    }

    let currentFree = free;
    let removed = 0;
    for (const entry of candidates) {
      if (currentFree >= EVICTION_TARGET_BYTES) break;
      const reclaimed = await DownloadIndex.deleteFiles(entry);
      await DownloadIndex.removeEntry(entry.downloadKey);
      currentFree += reclaimed;
      removed++;
    }

    if (removed > 0) {
      Sentry.addBreadcrumb({
        category: "storage",
        message: `Evicted ${removed} cached items (${Math.round(currentFree / MB)} MB free)`,
        level: "info"
      });
    }
  }

  private static accessTime(entry: DownloadedItemInterface): number {
    return entry.lastAccessedAt ?? entry.downloadedAt ?? 0;
  }
}
