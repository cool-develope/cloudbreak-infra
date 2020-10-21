export enum FieldName {
  feed = 'feed',
  feedPrivate = 'feedPrivate',
  myEvents = 'myEvents',
  upcomingEventsPrivate = 'upcomingEventsPrivate',
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
  organization: EventOrganization;
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
  organization: EventOrganization;
}

export interface FeedConnection {
  items: (Event | Post)[];
  totalCount: number;
}

export interface EventsConnection {
  items: Event[];
  totalCount: number;
}

export interface FeedPrivateFilterInput {
  search?: string;
  myContent?: Boolean;
  eventType?: EventType[];
  federation?: string[];
  club?: string[];
  team?: string[];
  discipline?: string[];
  createDateAfter?: string;
  createDateBefore?: string;
  startDateAfter?: string;
  startDateBefore?: string;
  endDateAfter?: string;
  endDateBefore?: string;
}

export interface FeedFilterInput {
  eventType?: EventType;
  clubId?: string;
  teamId?: string;
}

export interface MyEventsFilterInput {
  startDateAfter?: string;
  startDateBefore?: string;
  endDateAfter?: string;
  endDateBefore?: string;
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

export interface EventOrganization {
  id: string;
  name?: string;
  type: OrganizationType;
  walletId?: number;
}
