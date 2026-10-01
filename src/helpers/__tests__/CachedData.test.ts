import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";
import { CachedData } from "../CachedData";
import { getProvider } from "@churchapps/content-providers";

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

  it("gives each Google Drive file its own cache file", () => {
    expect(CachedData.getFilePath("https://drive.google.com/uc?id=vid1&export=download", "video"))
      .toBe("/cache/drive/vid1.mp4");
    expect(CachedData.getFilePath("https://drive.google.com/uc?id=aud1&export=download", "audio"))
      .toBe("/cache/drive/aud1.mp3");
    expect(CachedData.getFilePath("https://drive.google.com/uc?id=img1&export=download", "image"))
      .toBe("/cache/drive/img1.jpg");
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

  it("downloads a private Google Drive file with the OAuth token", async () => {
    await AsyncStorage.setItem("provider_auth_googledrive", JSON.stringify({
      access_token: "tok",
      refresh_token: "rt",
      token_type: "Bearer",
      created_at: 0,
      expires_in: 3600,
      scope: ""
    }));
    await CachedData.prefetch(
      [{ url: "https://drive.google.com/uc?id=vid1&export=download", fileType: "video" }] as any,
      () => {}
    );
    expect(RNFS.downloadFile).toHaveBeenCalledWith(expect.objectContaining({
      fromUrl: "https://www.googleapis.com/drive/v3/files/vid1?alt=media&supportsAllDrives=true",
      headers: { Authorization: "Bearer tok" },
      toFile: "/cache/drive/vid1.mp4"
    }));
  });

  it("downloads a OneDrive file from its freshly resolved pre-signed url", async () => {
    await AsyncStorage.setItem("provider_auth_onedrive", JSON.stringify({
      access_token: "tok",
      refresh_token: "rt",
      token_type: "Bearer",
      created_at: Math.floor(Date.now() / 1000),
      expires_in: 3600,
      scope: ""
    }));
    (getProvider as jest.Mock).mockReturnValueOnce({ id: "onedrive", config: {} });
    const realFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ "@microsoft.graph.downloadUrl": "https://dl.example/abc" }) })) as any;
    try {
      await CachedData.prefetch(
        [{ url: "https://graph.microsoft.com/v1.0/me/drive/items/A!1/content", fileType: "video" }] as any,
        () => {}
      );
      expect(global.fetch).toHaveBeenCalledWith("https://graph.microsoft.com/v1.0/me/drive/items/A!1", { headers: { Authorization: "Bearer tok" } });
      expect(RNFS.downloadFile).toHaveBeenCalledWith(expect.objectContaining({
        fromUrl: "https://dl.example/abc",
        headers: undefined,
        toFile: "/cache/onedrive/A!1.mp4"
      }));
    } finally {
      global.fetch = realFetch;
    }
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
