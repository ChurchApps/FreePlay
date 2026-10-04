import AsyncStorage from "@react-native-async-storage/async-storage";
import { getProvider } from "../../providers";
import { CachedData } from "../CachedData";
import { AnnouncementsHelper } from "../AnnouncementsHelper";

jest.mock("../../providers", () => ({ getProvider: jest.fn() }));
jest.mock("../ProviderAuthHelper", () => ({ ProviderAuthHelper: { refreshIfNeeded: jest.fn(async () => null) } }));

const folder = { type: "folder", id: "f1", title: "Announcements", path: "/f1" } as any;
const file = (id: string, extra: object = {}) => ({ type: "file", id, title: id, mediaType: "image", url: `https://a.com/x/${id}.jpg`, ...extra });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  CachedData.announcements = null;
});

it("loops slides, keeping assigned durations and defaulting the rest to 15s", async () => {
  const browse = jest.fn(async () => [file("a", { seconds: 8 }), file("b"), file("v", { mediaType: "video" }), { type: "folder", id: "sub" }]);
  (getProvider as jest.Mock).mockReturnValue({ browse });
  expect(await AnnouncementsHelper.setFolder("p1", folder)).toBe(true);
  const files = CachedData.announcements!.files;
  expect(files.map(f => f.seconds)).toEqual([8, 15, undefined]);
  expect(files.every(f => f.loop)).toBe(true);
  expect((await CachedData.getAsyncStorage("announcements")).files).toHaveLength(3);
});

it("keeps the current slides when the folder listing comes back empty", async () => {
  const browse = jest.fn().mockResolvedValueOnce([file("a")]).mockResolvedValueOnce([]);
  (getProvider as jest.Mock).mockReturnValue({ browse });
  await AnnouncementsHelper.setFolder("p1", folder);
  expect(await AnnouncementsHelper.sync()).toBe(false);
  expect(CachedData.announcements!.files).toHaveLength(1);
});
