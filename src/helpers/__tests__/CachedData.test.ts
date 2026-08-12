import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";
import { CachedData } from "../CachedData";

describe("CachedData.getFilePath", () => {
  it("maps a URL to the cache path, dropping the query string", () => {
    expect(CachedData.getFilePath("https://content.lessons.church/files/abc/video.mp4?token=1"))
      .toBe("/cache/files/abc/video.mp4");
  });

  it("returns empty string for empty url", () => {
    expect(CachedData.getFilePath("")).toBe("");
  });

  it("appends .mp4 to extensionless externalVideos URLs", () => {
    expect(CachedData.getFilePath("https://api.lessons.church/externalVideos/download/9DgTnt_fXPu"))
      .toBe("/cache/externalVideos/download/9DgTnt_fXPu.mp4");
  });

  it("does not double-append .mp4 when externalVideos URL already has an extension", () => {
    expect(CachedData.getFilePath("https://api.lessons.church/externalVideos/download/clip.mp4"))
      .toBe("/cache/externalVideos/download/clip.mp4");
  });
});

describe("CachedData.clearFocusMemory", () => {
  beforeEach(() => {
    CachedData.lastFocusedIndex = { browse: 1, browse_sub: 2, browser: 3, downloads: 4 };
  });

  it("clears everything with no arg", () => {
    CachedData.clearFocusMemory();
    expect(CachedData.lastFocusedIndex).toEqual({});
  });

  it("clears exact key and prefixed children only", () => {
    CachedData.clearFocusMemory("browse");
    expect(CachedData.lastFocusedIndex).toEqual({ browser: 3, downloads: 4 });
  });
});

describe("CachedData async storage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("round-trips objects through JSON", async () => {
    await CachedData.setAsyncStorage("k", { a: 1 });
    expect(await CachedData.getAsyncStorage("k")).toEqual({ a: 1 });
  });

  it("returns null for missing keys", async () => {
    expect(await CachedData.getAsyncStorage("nope")).toBeNull();
  });

  it("returns null on corrupt JSON instead of throwing", async () => {
    await AsyncStorage.setItem("bad", "{not json");
    expect(await CachedData.getAsyncStorage("bad")).toBeNull();
  });
});

describe("CachedData.prefetch", () => {
  beforeEach(() => jest.clearAllMocks());

  it("skips empty-URL files but still counts them", async () => {
    const progress: number[][] = [];
    await CachedData.prefetch(
      [{ url: "" }, { url: "https://a.com/x/y/f.mp4" }] as any,
      (c, t) => progress.push([c, t])
    );
    expect(RNFS.downloadFile).toHaveBeenCalledTimes(1);
    expect(progress).toEqual([[0, 2], [1, 2], [2, 2]]);
  });

  it("continues past a failed download", async () => {
    (RNFS.downloadFile as jest.Mock)
      .mockReturnValueOnce({ promise: Promise.resolve({ statusCode: 500 }) })
      .mockReturnValueOnce({ promise: Promise.resolve({ statusCode: 200 }) });
    const progress: number[][] = [];
    await CachedData.prefetch(
      [{ url: "https://a.com/x/y/bad.mp4" }, { url: "https://a.com/x/y/good.mp4" }] as any,
      (c, t) => progress.push([c, t])
    );
    expect(progress[progress.length - 1]).toEqual([2, 2]);
    expect(RNFS.downloadFile).toHaveBeenCalledTimes(2);
  });

  it("skips downloading files already on disk", async () => {
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(true);
    await CachedData.prefetch([{ url: "https://a.com/x/y/f.mp4" }] as any, () => {});
    expect(RNFS.downloadFile).not.toHaveBeenCalled();
  });
});

describe("CachedData.allFilesCached", () => {
  beforeEach(() => jest.clearAllMocks());

  it("true when all files exist (empty urls ignored)", async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    expect(await CachedData.allFilesCached([{ url: "" }, { url: "https://a.com/x/y/f.mp4" }] as any)).toBe(true);
  });

  it("false when any file is missing", async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    expect(await CachedData.allFilesCached([{ url: "https://a.com/x/y/f.mp4" }] as any)).toBe(false);
  });
});
