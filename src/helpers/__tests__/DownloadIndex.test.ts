import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";
import { DownloadIndex } from "../DownloadIndex";

const entry = (key: string, over: any = {}) => ({
  downloadKey: key,
  source: "plan",
  title: key,
  messageFiles: [{ url: `https://a.com/x/y/${key}.mp4` }],
  downloadedAt: 1000,
  ...over
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("DownloadIndex.generateKey", () => {
  it("joins source and non-empty ids", () => {
    expect(DownloadIndex.generateKey("plan", { planId: "p1", contentPath: "c1" })).toBe("plan:p1:c1");
  });

  it("filters out empty id values", () => {
    expect(DownloadIndex.generateKey("lesson", { a: "", b: "x" })).toBe("lesson:x");
  });
});

describe("DownloadIndex entries", () => {
  it("getAll returns [] when index missing or not an array", async () => {
    expect(await DownloadIndex.getAll()).toEqual([]);
    await AsyncStorage.setItem("downloadIndex", JSON.stringify({ nope: true }));
    expect(await DownloadIndex.getAll()).toEqual([]);
  });

  it("addEntry prepends new entries and stamps lastAccessedAt", async () => {
    await DownloadIndex.addEntry(entry("a") as any);
    await DownloadIndex.addEntry(entry("b") as any);
    const all = await DownloadIndex.getAll();
    expect(all.map(e => e.downloadKey)).toEqual(["b", "a"]);
    expect(all[0].lastAccessedAt).toBe(1000);
  });

  it("addEntry replaces an existing entry with the same key", async () => {
    await DownloadIndex.addEntry(entry("a") as any);
    await DownloadIndex.addEntry(entry("a", { title: "updated" }) as any);
    const all = await DownloadIndex.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("updated");
  });

  it("removeEntry removes only the matching key", async () => {
    await DownloadIndex.addEntry(entry("a") as any);
    await DownloadIndex.addEntry(entry("b") as any);
    await DownloadIndex.removeEntry("a");
    expect((await DownloadIndex.getAll()).map(e => e.downloadKey)).toEqual(["b"]);
  });
});

describe("DownloadIndex.verifyFiles / getVerifiedEntries", () => {
  it("verifyFiles is true when files exist, ignoring empty urls", async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    const e = entry("a", { messageFiles: [{ url: "" }, { url: "https://a.com/x/y/a.mp4" }] });
    expect(await DownloadIndex.verifyFiles(e as any)).toBe(true);
  });

  it("getVerifiedEntries prunes entries with missing files when asked", async () => {
    await DownloadIndex.addEntry(entry("good") as any);
    await DownloadIndex.addEntry(entry("bad") as any);
    (RNFS.exists as jest.Mock).mockImplementation(async (p: string) => p.includes("good"));
    const verified = await DownloadIndex.getVerifiedEntries(true);
    expect(verified.map(e => e.downloadKey)).toEqual(["good"]);
    expect((await DownloadIndex.getAll()).map(e => e.downloadKey)).toEqual(["good"]);
  });

  it("getVerifiedEntries without prune keeps the index intact", async () => {
    await DownloadIndex.addEntry(entry("bad") as any);
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    expect(await DownloadIndex.getVerifiedEntries()).toEqual([]);
    expect(await DownloadIndex.getAll()).toHaveLength(1);
  });
});

describe("DownloadIndex.deleteFiles", () => {
  it("unlinks files and totals reclaimed bytes, ignoring missing files", async () => {
    (RNFS.stat as jest.Mock)
      .mockResolvedValueOnce({ size: 100 })
      .mockRejectedValueOnce(new Error("gone"));
    const e = entry("a", { messageFiles: [{ url: "https://a.com/x/y/1.mp4" }, { url: "https://a.com/x/y/2.mp4" }] });
    expect(await DownloadIndex.deleteFiles(e as any)).toBe(100);
    expect(RNFS.unlink).toHaveBeenCalledTimes(1);
  });
});
