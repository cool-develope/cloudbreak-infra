export enum FieldName {
  feed = 'feed',
  feedPrivate = 'feedPrivate',
}

export enum EventType {
  Event = 'Event',
  Post = 'Post',
}

export enum UserRole {
  Coach = 'Coach',
  Adult = 'Adult',
  Parent = 'Parent',
  Teenager = 'Teenager',
  Fan = 'Fan',
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

export interface Event {
  __typename: EventType;
  id: string;
  title: string;
  description: string;
  image: Image;
  startDate: string;
  endDate: string;
  address: string;
  discipline: string[];
  price: number;
  likesCount: number;
  viewsCount: number;
  acceptedCount: number;
  author: {
    id: string;
  };
}

export interface Post {
  __typename: EventType;
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
  createDate: string;
}

export interface FeedConnection {
  items: (Event | Post)[];
  totalCount: number;
}

export interface FeedFilterInput {
  search?: string;
  myContent?: Boolean;
  eventType?: EventType[] | EventType;
  federation?: string[];
  club?: string[];
  team?: string[];
  clubId?: string;
  teamId?: string;
  discipline?: string[];
  createDateAfter?: string;
  createDateBefore?: string;
  startDateAfter?: string;
  startDateBefore?: string;
  endDateAfter?: string;
  endDateBefore?: string;
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
  discipline?: string[];
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

export interface AttachmentItemRecord {
  key: string;
  size: number;
}
