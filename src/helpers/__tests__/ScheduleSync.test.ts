import RNFS from "react-native-fs";
import { ApiHelper } from "../ApiHelper";
import { CachedData } from "../CachedData";
import { ScheduleClock } from "../ScheduleClock";
import { ScheduleSync } from "../ScheduleSync";

jest.mock("../ApiHelper", () => ({ ApiHelper: { getAnonymous: jest.fn(), post: jest.fn(async () => ({})) } }));
jest.mock("../DeviceHelper", () => ({ DeviceHelper: { getDeviceId: jest.fn(async () => "dev1"), getSecret: jest.fn(async () => "secret") } }));
jest.mock("../../providers", () => ({ getProvider: jest.fn() }));

const slide = { cacheKey: "kids-04", title: "04-kids-church.png", mediaType: "image", seconds: 8, loopVideo: false, url: "https://dl.example.com/04.png", headers: { Authorization: "Bearer t" }, resolve: "url" } as any;
const manifest = { timeZone: "America/Chicago", screenGroupName: "Kids", generatedAt: "", rev: "r1", validUntil: "", fallbackTitle: "Loop", fallback: [slide], occurrences: [] } as any;

beforeEach(async () => {
  jest.clearAllMocks();
  (RNFS as any).moveFile = jest.fn(async () => {});
  (RNFS as any).readDir = jest.fn(async () => []);
  (ApiHelper.getAnonymous as jest.Mock).mockResolvedValue(manifest);
  (RNFS.exists as jest.Mock).mockResolvedValue(true);
  await ScheduleSync.setPaired("G");
  await CachedData.setAsyncStorage("scheduleManifest", manifest);
  await ScheduleSync.load();
});

// Issue #1297: a cached file that fails to play must not be picked again, and must be downloaded again.
it("takes a file that failed to play out of rotation and downloads it again", async () => {
  expect(ScheduleSync.isCached("kids-04")).toBe(true);
  const retry = ScheduleSync.markBroken(slide);
  expect(ScheduleClock.nextStep(0, [ScheduleSync.isCached("kids-04")], "loop")).toEqual({ index: -1 });
  await retry;
  expect(RNFS.downloadFile).toHaveBeenCalledWith(expect.objectContaining({ fromUrl: slide.url }));
  expect(ScheduleSync.isCached("kids-04")).toBe(true);
});
