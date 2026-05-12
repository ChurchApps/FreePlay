import Constants from "expo-constants";
import brandingJson from "../../branding.json";

type BrandingShape = typeof brandingJson;

const fromConstants = (Constants.expoConfig?.extra as { branding?: BrandingShape } | undefined)?.branding;

export const Branding: BrandingShape = fromConstants ?? brandingJson;

export const isLocked = Branding.providerIds.length === 1;
export const lockedProviderId: string | null = isLocked ? Branding.providerIds[0] : null;
