export enum FieldName {
  event = 'event',
  post = 'post',
  eventPrivate = 'eventPrivate',
  postPrivate = 'postPrivate',
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
  size: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  image: Image;
  startDate: string;
  endDate: string;
  address: string;
  discipline: string;
  price: number;
  likesCount: number;
  viewsCount: number;
  acceptedCount: number;
  author: {
    id: string;
  };
  repeatType: string;
  target?: EventTarget;
}

export interface Post {
  id: string;
  title: string;
  description: string;
  image: Image;
  attachment: File[];
  likesCount: number;
  viewsCount: number;
  author: {
    id: string;
  };
  target?: EventTarget;
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
  userRole?: string[];
}

export interface EventRecord {
  pk: string;
  sk: string;
  eventType: EventType;
  title: string;
  description: string;
  image: string;
  attachment?: AttachmentItemRecord[];
  startDate: string;
  endDate: string;
  address: string;
  discipline: string;
  price: number;
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
  targetUserRole?: string[];
}

export interface AttachmentItemRecord {
  key: string;
  size: number;
}
