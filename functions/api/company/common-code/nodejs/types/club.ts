export enum FieldName {
  createClubPrivate = 'createClubPrivate',
  updateClubPrivate = 'updateClubPrivate',
  club = 'club',
  clubs = 'clubs',
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

export enum TeamMemberType {
  Member = 'Member',
  Coach = 'Coach',
}

export enum TeamInvitationStatus {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Declined = 'Declined',
}

export interface Image {
  url: string;
}

export interface ClubRecord {
  pk?: string;
  sk?: string;
  name?: string;
  description?: string;
  cover?: string;
  logo?: string;
  code?: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;
  discipline?: string[];
  federations?: string[];
  ownerUserId?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface Club {
  id: string;
  name: string;
  description: string;
  cover: Image;
  logo: Image;
  code: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  discipline: string[];
  teams: TeamShortConnection | null;
  coaches: UserShortConnection | null;
  members: UserShortConnection | null;
  friends: UserShortConnection | null;
  federations: FederationShortConnection | null;
  upcomingEventsCount: number;
}

export interface FederationShortConnection {
  items: FederationShort[];
  totalCount: number;
}

export interface FederationShort {
  id: string;
  name: string;
  logo: Image;
}

export interface TeamShortConnection {
  items: TeamShort[];
  totalCount: number;
}

export interface TeamShort {
  id: string;
  name: string;
  logo: Image;
}

export interface UserShortConnection {
  items: UserShort[];
  totalCount: number;
}

export interface UserShort {
  id: string;
  name: string;
  logo: Image;
}

export interface UpdateClubPrivateInput {
  id?: string;
  name: string;
  description?: string;
  cover?: string;
  logo?: string;
  code?: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;
  discipline?: string[];
  federations?: string[];
}

export interface UpdateClubPrivatePayload {
  errors: string[];
  club: Club;
}

export interface ClubsFilterInput {
  search?: string;
  discipline?: string[];
  city?: string;
  isMembership?: boolean;
}

export interface ClubsConnection {
  items: Club[];
  totalCount: number;
}

export interface FunctionEvent {
  arguments: {
    input: UpdateClubPrivateInput;
    clubId: string;
    filter: ClubsFilterInput;
    limit?: number;
    from?: number;
  };
  identity: { sub: string };
  info: { fieldName: string };
}
