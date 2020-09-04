export enum FieldName {
  createEvent = 'createEvent',
  createPost = 'createPost',
}

export enum UserRole {
  Coach = 'Coach',
  Adult = 'Adult',
  Parent = 'Parent',
  Teenager = 'Teenager',
  Fan = 'Fan',
}

export enum EventType {
  Event = 'Event',
  Post = 'Post',
}

export enum RepeatType {
  None = 'None',
  Weekly = 'Weekly',
  Monthly = 'Monthly',
}

export interface Image {
  url: string;
}

export interface File {
  url: string;
}

export interface CreateEventInput {
  title?: string;
  description?: string;
  image?: string;
  startDate?: string;
  endDate?: string;
  address?: string;
  discipline?: string;
  price?: number;
  repeatType?: RepeatType;
  target?: EventTargetInput;
}

export interface CreatePostInput {
  title?: string;
  description?: string;
  image?: string;
  attachment?: string;
  target?: EventTargetInput;
}

export interface EventTargetInput {
  country?: string;
  federation?: string[];
  club?: string[];
  discipline?: string[];
  team?: string[];
  userRole?: string[];
}

export interface EventTarget {
  country?: string;
  federation?: {
    id: string;
    name?: string;
  }[];
  club?: {
    id: string;
    name?: string;
  }[];
  discipline?: string[];
  team?: {
    id: string;
    name?: string;
  }[];
  userRole?: UserRole[];
}

export interface CreateEventPayload {
  errors?: string[];
  event?: EventForAdmin | null;
}

export interface CreatePostPayload {
  errors?: string[];
  post?: PostForAdmin | null;
}

export interface EventForAdmin {
  id?: string;
  title?: string;
  description?: string;
  image?: Image;
  startDate?: string;
  endDate?: string;
  address?: string;
  discipline?: string;
  price?: number;
  likesCount?: number;
  viewsCount?: number;
  acceptedCount: number;
  repeatType: RepeatType;
  target?: EventTarget;
}

export interface PostForAdmin {
  id?: string;
  title?: string;
  description?: string;
  image?: Image;
  attachment?: File;
  likesCount?: number;
  viewsCount?: number;
  target?: EventTarget;
}

export interface EventRecord {
  pk: string;
  sk: string;
  eventType: EventType;
  title: string;
  description?: string;
  image: string;
  attachment: string;
  startDate?: string;
  endDate?: string;
  address?: string;
  discipline?: string;
  price?: number;
  likesCount: number;
  viewsCount: number;
  acceptedCount: number;
  createdAt: string;
  modifiedAt: string;
  ownerUserId: string;
  isDeleted: boolean;
  repeatType: string;
  targetCountry?: string;
  targetFederation?: string[];
  targetClub?: string[];
  targetDiscipline?: string[];
  targetTeam?: string[];
  targetUserRole?: UserRole[];
}
