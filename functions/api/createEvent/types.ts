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
  FOOTBALL = 'FOOTBALL',
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

export enum OrganizationType {
  Federation = 'Federation',
  Club = 'Club',
}

export interface Image {
  url: string;
}

export interface File {
  url: string;
  key: string;
  size: number;
}

export interface CreateEventInput {
  id?: string;
  clubId?: string;
  federationId?: string;
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
  clubId?: string;
  federationId?: string;
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
  event?: Event | null;
}

export interface CreatePostPayload {
  errors?: string[];
  post?: Post | null;
}

export interface Event {
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
  organization: EventOrganization;
}

export interface Post {
  id?: string;
  title?: string;
  description?: string;
  image?: Image;
  attachment?: File[];
  likesCount?: number;
  viewsCount?: number;
  target?: EventTarget;
  createDate: string;
  organization: EventOrganization;
}

export interface EventRecord {
  pk: string;
  sk: string;
  clubId?: string;
  federationId?: string;
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

export interface EventOrganization {
  id: string;
  name?: string;
  type: OrganizationType;
  walletId?: number;
}
