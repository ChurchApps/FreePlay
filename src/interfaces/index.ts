export interface ChurchInterface {
  id?: string;
  name?: string;
  subDomain?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  logoSquare?: string;
}

export interface ClassroomInterface {
  id?: string;
  churchId?: string;
  name?: string;
  lessonId?: string;
}

export interface LessonPlaylistInterface {
  id?: string;
  lessonId?: string;
  venueId?: string;
  messages?: LessonPlaylistMessageInterface[];
  lessonName?: string;
  lessonTitle?: string;
  lessonDescription?: string;
  lessonImage?: string;
}

export interface LessonPlaylistMessageInterface {
  id?: string;
  playlistId?: string;
  name?: string;
  sort?: number;
  files?: LessonPlaylistFileInterface[];
}

export interface LessonPlaylistFileInterface {
  id?: string;
  messageId?: string;
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

export interface DownloadedLessonInterface {
  downloadKey: string;
  source: "classroom" | "provider" | "plan";
  providerId?: string;
  lessonName?: string;
  lessonTitle?: string;
  lessonDescription?: string;
  lessonImage?: string;
  playlist?: LessonPlaylistInterface;
  messageFiles: LessonPlaylistFileInterface[];
  downloadedAt: number;
}

export * from "./ContentProviderInterfaces";
