export type { MessageFileInterface } from "@churchapps/content-providers";
import type { MessageFileInterface } from "@churchapps/content-providers";

export interface DeviceInterface {
  id?: string;
  deviceId?: string;
  churchId?: string;
  providerId?: string;
  pairingData?: unknown;
  pairingCode?: string;
}

export interface DownloadedItemInterface {
  downloadKey: string;
  source: "provider" | "plan";
  providerId?: string;
  title?: string;
  description?: string;
  image?: string;
  messageFiles: MessageFileInterface[];
  downloadedAt: number;
  lastAccessedAt?: number;
}

export * from "./ContentProviderInterfaces";
