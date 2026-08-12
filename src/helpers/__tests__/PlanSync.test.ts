import AsyncStorage from "@react-native-async-storage/async-storage";
import { getProvider } from "../../providers";
import { ProviderAuthHelper } from "../ProviderAuthHelper";
import { CachedData } from "../CachedData";
import { DownloadIndex } from "../DownloadIndex";
import { PlanSync } from "../PlanSync";

jest.mock("../../providers", () => ({ getProvider: jest.fn() }));
jest.mock("../ProviderAuthHelper", () => ({ ProviderAuthHelper: { refreshIfNeeded: jest.fn(async () => null) } }));

const plan = (id: string, urls: string[]) => ({ id, title: "Plan " + id, files: urls.map(url => ({ url })) });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  CachedData.providerId = null;
  CachedData.currentPlan = null;
  CachedData.currentScreen = "";
  CachedData.messageFiles = [];
});

it("does nothing without a paired provider", async () => {
  await PlanSync.syncCurrentPlan();
  expect(getProvider).not.toHaveBeenCalled();
});

it("defers to PlanDownloadScreen when it is active", async () => {
  CachedData.providerId = "p1";
  CachedData.currentScreen = "planDownload";
  await PlanSync.syncCurrentPlan();
  expect(getProvider).not.toHaveBeenCalled();
});

it("does nothing when provider has no current plan", async () => {
  CachedData.providerId = "p1";
  (getProvider as jest.Mock).mockReturnValue({ getCurrentPlan: jest.fn(async () => null) });
  await PlanSync.syncCurrentPlan();
  expect(CachedData.currentPlan).toBeNull();
});

it("persists and indexes a new plan", async () => {
  CachedData.providerId = "p1";
  const newPlan = plan("plan1", ["https://a.com/x/y/f1.mp4"]);
  (getProvider as jest.Mock).mockReturnValue({ getCurrentPlan: jest.fn(async () => newPlan) });
  await PlanSync.syncCurrentPlan();
  expect(CachedData.currentPlan).toEqual(newPlan);
  expect(await CachedData.getAsyncStorage("currentPlan")).toEqual(newPlan);
  expect(await CachedData.getAsyncStorage("messageFiles")).toEqual(newPlan.files);
  const entries = await DownloadIndex.getAll();
  expect(entries).toHaveLength(1);
  expect(entries[0].downloadKey).toBe("plan:plan1:plan1");
  expect(ProviderAuthHelper.refreshIfNeeded).toHaveBeenCalledWith("p1");
});

it("skips persisting when the plan is unchanged", async () => {
  CachedData.providerId = "p1";
  CachedData.currentPlan = plan("plan1", ["https://a.com/x/y/f1.mp4"]) as any;
  (getProvider as jest.Mock).mockReturnValue({ getCurrentPlan: jest.fn(async () => plan("plan1", ["https://a.com/x/y/f1.mp4"])) });
  const spy = jest.spyOn(CachedData, "setAsyncStorage");
  await PlanSync.syncCurrentPlan();
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

it("re-downloads when a file URL changes on the same plan", async () => {
  CachedData.providerId = "p1";
  CachedData.currentPlan = plan("plan1", ["https://a.com/x/y/old.mp4"]) as any;
  const newPlan = plan("plan1", ["https://a.com/x/y/new.mp4"]);
  (getProvider as jest.Mock).mockReturnValue({ getCurrentPlan: jest.fn(async () => newPlan) });
  await PlanSync.syncCurrentPlan();
  expect(CachedData.currentPlan).toEqual(newPlan);
});

it("recovers after a provider error so the next sync still runs", async () => {
  CachedData.providerId = "p1";
  const good = plan("plan2", ["https://a.com/x/y/f.mp4"]);
  const getCurrentPlan = jest.fn()
    .mockRejectedValueOnce(new Error("network down"))
    .mockResolvedValueOnce(good);
  (getProvider as jest.Mock).mockReturnValue({ getCurrentPlan });
  await PlanSync.syncCurrentPlan();
  expect(CachedData.currentPlan).toBeNull();
  await PlanSync.syncCurrentPlan();
  expect(CachedData.currentPlan).toEqual(good);
});
