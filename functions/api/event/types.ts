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
  target: EventTarget;
  organization: EventOrganization;
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
  target: EventTarget;
  organization: EventOrganization;
}

export interface IdName {
  id: string;
  name?: string;
}

export interface EventTarget {
  country?: string;
  federation?: IdName[];
  club?: IdName[];
  discipline?: string[];
  team?: IdName[];
  userRole?: string[];
}

export interface EventRecord {
  pk: string;
  sk: string;
  clubId?: string;
  federationId?: string;
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

export interface EventOrganization {
  id: string;
  name?: string;
  type: OrganizationType;
  walletId?: number;
}
