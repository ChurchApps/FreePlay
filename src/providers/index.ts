import { Branding } from "../branding";
import { browse } from "../../modules/mdns";
import { freeShowServicesToInstances, getProvider, setProviderSecret, type FreeShowProvider, type GoCurriculumProvider } from "@churchapps/content-providers";
import { ApiHelper } from "../helpers/ApiHelper";

setProviderSecret("gocurriculum", process.env.EXPO_PUBLIC_GOCURRICULUM_CLIENT_SECRET || "");
setProviderSecret("googledrive", process.env.EXPO_PUBLIC_GOOGLEDRIVE_CLIENT_SECRET || "");
setProviderSecret("onedrive", process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_SECRET || "");

(getProvider("freeshow") as FreeShowProvider | null)?.setDiscoverer(async () => freeShowServicesToInstances(await browse("_freeshow._udp", 3000)));
// Go's feed URLs are private to the Api, so the catalog comes through the relay with the device's Go token
(getProvider("gocurriculum") as GoCurriculumProvider | null)?.setCatalogLoader((groupId, auth) => ApiHelper.post("/oauth/relay/gocurriculum/catalog", { groupId, accessToken: auth.access_token }, "RelayApi"));

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
