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

export interface ProgramInterface {
  id?: string;
  name?: string;
  slug?: string;
  image?: string;
  shortDescription?: string;
  description?: string;
  videoEmbedUrl?: string;
  live?: boolean;
  aboutSection?: string;
}

export interface StudyInterface {
  id?: string;
  programId?: string;
  name?: string;
  slug?: string;
  image?: string;
  shortDescription?: string;
  description?: string;
  videoEmbedUrl?: string;
  live?: boolean;
  sort?: number;
}

export interface LessonInterface {
  id?: string;
  studyId?: string;
  name?: string;
  slug?: string;
  title?: string;
  image?: string;
  description?: string;
  live?: boolean;
  sort?: number;
  videoEmbedUrl?: string;
}

export interface VenueInterface {
  id?: string;
  lessonId?: string;
  name?: string;
  sort?: number;
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

export interface FeedVenueInterface {
  id?: string;
  lessonId?: string;
  name?: string;
  lessonName?: string;
  lessonDescription?: string;
  lessonImage?: string;
  sections?: FeedSectionInterface[];
}

export interface FeedSectionInterface {
  id?: string;
  name?: string;
  actions?: FeedActionInterface[];
}

export interface FeedActionInterface {
  id?: string;
  actionType?: string;
  content?: string;
  files?: FeedFileInterface[];
}

export interface FeedFileInterface {
  id?: string;
  name?: string;
  url?: string;
  streamUrl?: string;
  seconds?: number;
  fileType?: string;
}

export * from "./ContentProviderInterfaces";
