import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";
import { DownloadIndex } from "../DownloadIndex";
import { StorageManager } from "../StorageManager";

const MB = 1024 * 1024;

const entry = (key: string, accessed: number) => ({
  downloadKey: key,
  source: "plan",
  title: key,
  messageFiles: [{ url: `https://a.com/x/y/${key}.mp4` }],
  downloadedAt: accessed,
  lastAccessedAt: accessed
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("StorageManager.getFreeBytes", () => {
  it("returns free space from the filesystem", async () => {
    (RNFS.getFSInfo as jest.Mock).mockResolvedValue({ freeSpace: 42 });
    expect(await StorageManager.getFreeBytes()).toBe(42);
  });

  it("returns Infinity when the filesystem query fails", async () => {
    (RNFS.getFSInfo as jest.Mock).mockRejectedValue(new Error("boom"));
    expect(await StorageManager.getFreeBytes()).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("StorageManager.touchEntry", () => {
  it("updates lastAccessedAt for the matching entry", async () => {
    await DownloadIndex.addEntry(entry("a", 1) as any);
    const before = Date.now();
    await StorageManager.touchEntry("a");
    const all = await DownloadIndex.getAll();
    expect(all[0].lastAccessedAt).toBeGreaterThanOrEqual(before);
  });

  it("is a no-op for unknown keys", async () => {
    await StorageManager.touchEntry("missing");
    expect(await DownloadIndex.getAll()).toEqual([]);
  });
});

describe("StorageManager.ensureFreeSpace", () => {
  it("does nothing when free space is above the threshold", async () => {
    (RNFS.getFSInfo as jest.Mock).mockResolvedValue({ freeSpace: 600 * MB });
    await DownloadIndex.addEntry(entry("a", 1) as any);
    await StorageManager.ensureFreeSpace();
    expect(await DownloadIndex.getAll()).toHaveLength(1);
    expect(RNFS.unlink).not.toHaveBeenCalled();
  });

  it("evicts least-recently-used entries first and stops at the target", async () => {
    await DownloadIndex.addEntry(entry("newest", 3000) as any);
    await DownloadIndex.addEntry(entry("oldest", 1000) as any);
    await DownloadIndex.addEntry(entry("middle", 2000) as any);
    (RNFS.getFSInfo as jest.Mock).mockResolvedValue({ freeSpace: 100 * MB });
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1000 * MB });
    await StorageManager.ensureFreeSpace();
    // 100MB + 1000MB reclaimed >= 1024MB target after evicting just the oldest
    const remaining = (await DownloadIndex.getAll()).map(e => e.downloadKey).sort();
    expect(remaining).toEqual(["middle", "newest"]);
  });

  it("keeps evicting until the target is met", async () => {
    await DownloadIndex.addEntry(entry("a", 1000) as any);
    await DownloadIndex.addEntry(entry("b", 2000) as any);
    await DownloadIndex.addEntry(entry("c", 3000) as any);
    (RNFS.getFSInfo as jest.Mock).mockResolvedValue({ freeSpace: 100 * MB });
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: 500 * MB });
    await StorageManager.ensureFreeSpace();
    // needs 1024MB: 100 + 500 + 500 = 1100 after two evictions
    expect((await DownloadIndex.getAll()).map(e => e.downloadKey)).toEqual(["c"]);
  });

  it("never evicts protected entries", async () => {
    await DownloadIndex.addEntry(entry("keep", 1000) as any);
    await DownloadIndex.addEntry(entry("evict", 2000) as any);
    (RNFS.getFSInfo as jest.Mock).mockResolvedValue({ freeSpace: 100 * MB });
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: 2000 * MB });
    await StorageManager.ensureFreeSpace(["keep"]);
    expect((await DownloadIndex.getAll()).map(e => e.downloadKey)).toEqual(["keep"]);
  });

  it("survives having no evictable entries", async () => {
    (RNFS.getFSInfo as jest.Mock).mockResolvedValue({ freeSpace: 100 * MB });
    await expect(StorageManager.ensureFreeSpace()).resolves.toBeUndefined();
  });
});
