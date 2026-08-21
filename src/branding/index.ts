import brandingJson from "../../branding.json";

// Always use the bundled copy — the Constants.expoConfig snapshot is baked at APK
// build time and goes stale on OTA/Metro updates (hid newly added providers).
export const Branding = brandingJson;

export const isLocked = Branding.providerIds.length === 1;
export const lockedProviderId: string | null = isLocked ? Branding.providerIds[0] : null;
