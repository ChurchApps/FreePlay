import { CurrentPlan } from "@churchapps/content-providers";
import { CachedData } from "./CachedData";
import { ProviderAuthHelper } from "./ProviderAuthHelper";
import { StorageManager } from "./StorageManager";
import { DownloadIndex } from "./DownloadIndex";
import { getProvider } from "../providers";

let syncing = false;

function planChanged(oldPlan: CurrentPlan | null, newPlan: CurrentPlan): boolean {
  if (!oldPlan) return true;
  if (oldPlan.id !== newPlan.id) return true;
  const oldFiles = oldPlan.files || [];
  const newFiles = newPlan.files || [];
  if (oldFiles.length !== newFiles.length) return true;
  return newFiles.some((f, i) => f.url !== oldFiles[i]?.url);
}

export class PlanSync {
  /** Re-fetch the current plan and, if it changed, persist + download the new files. */
  static async syncCurrentPlan(): Promise<void> {
    if (syncing) return;
    // PlanDownloadScreen drives its own fetch + progress UI when active
    if (CachedData.currentScreen === "planDownload") return;

    const providerId = CachedData.providerId;
    const scheduleId = CachedData.scheduleId;
    if (!providerId || !scheduleId) return;

    const provider = getProvider(providerId);
    if (!provider?.getCurrentPlan) return;

    syncing = true;
    try {
      const auth = await ProviderAuthHelper.refreshIfNeeded(providerId);
      const newPlan = await provider.getCurrentPlan(scheduleId, auth);
      if (!newPlan) return;

      if (!planChanged(CachedData.currentPlan, newPlan)) return;

      CachedData.currentPlan = newPlan;
      await CachedData.setAsyncStorage("currentPlan", newPlan);
      const files = newPlan.files || [];
      CachedData.messageFiles = files;
      await CachedData.setAsyncStorage("messageFiles", files);

      const downloadKey = DownloadIndex.generateKey("plan", { planId: newPlan.id, contentPath: newPlan.id });
      await StorageManager.ensureFreeSpace([downloadKey]);
      await CachedData.prefetch(files, () => {});
      DownloadIndex.addEntry({
        downloadKey,
        source: "plan",
        title: newPlan.title || "",
        messageFiles: files,
        downloadedAt: Date.now()
      });
    } catch (err) {
      console.error("[PlanSync] sync failed:", err);
    } finally {
      syncing = false;
    }
  }
}
