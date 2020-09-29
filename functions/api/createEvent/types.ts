export enum FieldName {
  createEvent = 'createEvent',
  createPost = 'createPost',
  updateEvent = 'updateEvent',
  updatePost = 'updatePost',
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

export enum Discipline {
  SOCCER = 'SOCCER',
  TENNIS = 'TENNIS',
  PADEL = 'PADEL',
  BASKETBALL = 'BASKETBALL',
  VOLLEYBALL = 'VOLLEYBALL',
  ATHLETICS = 'ATHLETICS',
  ROWING = 'ROWING',
  BADMINTON = 'BADMINTON',
  BOXING = 'BOXING',
  CANOE_KAYAK = 'CANOE_KAYAK',
  CYCLING = 'CYCLING',
  GOLF = 'GOLF',
  GYMNASTIC = 'GYMNASTIC',
  HANDBALL = 'HANDBALL',
  JUDO = 'JUDO',
  SWIMMING = 'SWIMMING',
  RUGBY = 'RUGBY',
  EQUESTRIAN = 'EQUESTRIAN',
  TAEKWONDO = 'TAEKWONDO',
  TABLE_TENNIS = 'TABLE_TENNIS',
}

export interface Image {
  url: string;
}

export interface File {
  url: string;
  size: number;
}

export interface CreateEventInput {
  id?: string;
  title?: string;
  description?: string;
  image?: string;
  startDate?: string;
  endDate?: string;
  address?: string;
  discipline?: string[];
  price?: number;
  repeatType?: RepeatType;
  target?: EventTargetInput;
}

export interface CreatePostInput {
  id?: string;
  title?: string;
  description?: string;
  image?: string;
  attachment?: string[];
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
  discipline?: Discipline[];
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
  discipline?: Discipline[];
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
  attachment?: File[];
  likesCount?: number;
  viewsCount?: number;
  target?: EventTarget;
  createDate: string;
}

export interface EventRecord {
  pk: string;
  sk: string;
  eventType: EventType;
  title: string;
  description?: string;
  image: string;
  attachment?: AttachmentItemRecord[];
  startDate?: string;
  endDate?: string;
  address?: string;
  discipline?: Discipline[];
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
  targetDiscipline?: Discipline[];
  targetTeam?: string[];
  targetUserRole?: UserRole[];
}

export interface AttachmentItemRecord {
  key: string;
  size: number;
}
