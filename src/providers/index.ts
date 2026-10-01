import { Branding } from "../branding";
import { setProviderSecret } from "@churchapps/content-providers";

setProviderSecret("gocurriculum", process.env.EXPO_PUBLIC_GOCURRICULUM_CLIENT_SECRET || "");
setProviderSecret("googledrive", process.env.EXPO_PUBLIC_GOOGLEDRIVE_CLIENT_SECRET || "");
setProviderSecret("onedrive", process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_SECRET || "");

export {
  getProvider,
  getAllProviders,
  registerProvider,
  getProviderConfig,
  getAvailableProviders,
  networkInstanceToAuth,
  type IProvider,
  type Instructions,
  type InstructionItem,
  type ContentFile,
  type ContentFolder,
  type ContentItem,
  type NetworkInstance
} from "@churchapps/content-providers";

/** Provider IDs shown in the FreePlay app. Sourced from branding.json so forks can lock to one. */
export const FREEPLAY_PROVIDER_IDS: string[] = Branding.providerIds;
