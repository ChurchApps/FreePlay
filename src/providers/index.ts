import { Branding } from "../branding";

export {
  getProvider,
  getAllProviders,
  registerProvider,
  getProviderConfig,
  getAvailableProviders,
  type IProvider,
  type Instructions,
  type InstructionItem,
  type ContentFile,
  type ContentFolder,
  type ContentItem
} from "@churchapps/content-providers";

/** Provider IDs shown in the FreePlay app. Sourced from branding.json so forks can lock to one. */
export const FREEPLAY_PROVIDER_IDS: string[] = Branding.providerIds;
