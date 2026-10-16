export type { MessageFileInterface } from "@churchapps/content-providers";
import type { MessageFileInterface } from "@churchapps/content-providers";

export interface DeviceInterface {
  id?: string;
  deviceId?: string;
  churchId?: string;
  contentType?: string;
  contentId?: string;
  pairingCode?: string;
  secret?: string;
}

export type ScheduleEndBehavior = "loop" | "holdLast" | "fallback";

export interface ScheduleItem {
  cacheKey: string;
  title: string;
  mediaType: "video" | "image" | "audio";
  seconds: number;
  loopVideo: boolean;
  url?: string;
  headers?: Record<string, string>;
  expiresAt?: string;
  resolve: "url" | "lan";
  providerId?: string;
  providerPath?: string;
  fileId?: string;
}

export interface ScheduleOccurrence {
  id: string;
  title?: string;
  start: string;
  end: string;
  endBehavior: ScheduleEndBehavior;
  items: ScheduleItem[];
}

export interface ScheduleManifest {
  timeZone: string;
  generatedAt: string;
  rev: string | number;
  validUntil: string;
  screenGroupName?: string;
  fallbackTitle?: string;
  fallback: ScheduleItem[] | null;
  occurrences: ScheduleOccurrence[];
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
