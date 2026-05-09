export interface MessageFileInterface {
  id?: string;
  name?: string;
  url?: string;
  seconds?: number;
  fileType?: string;
  sort?: number;
  loop?: boolean;
  loopVideo?: boolean;
  image?: string;
}

export interface DeviceInterface {
  id?: string;
  deviceId?: string;
  churchId?: string;
  contentType?: string;
  contentId?: string;
  pairingCode?: string;
}

export interface PlanInterface {
  id?: string;
  churchId?: string;
  planTypeId?: string;
  name?: string;
  serviceDate?: Date;
  contentType?: string;
  contentId?: string;
  providerId?: string;
  providerPlanId?: string;
  providerPlanName?: string;
}

export interface PlanItemInterface {
  id?: string;
  churchId?: string;
  planId?: string;
  parentId?: string;
  sort?: number;
  itemType?: string;
  relatedId?: string;
  label?: string;
  description?: string;
  seconds?: number;
  link?: string;
  children?: PlanItemInterface[];
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
