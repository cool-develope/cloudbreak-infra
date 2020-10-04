export enum FieldName {
  createTeamPrivate = 'createTeamPrivate',
  updateTeamPrivate = 'updateTeamPrivate',
  team = 'team',
  teamsPrivate = 'teamsPrivate',
  parentTeam = 'parentTeam',
  clubTeams = 'clubTeams',
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

export interface TeamRecord {
  pk?: string;
  sk?: string;
  name?: string;
  description?: string;
  cover: string | null;
  logo: string | null;
  parentTeamId: string | null;
  address?: string;
  email?: string;
  phone?: string;
  discipline?: string;
  federations?: string[];
  ownerUserId?: string;
  modifiedAt?: string;
  ciCount?: number | null,
  miCount?: number | null,
}

export interface Team {
  id: string;
  clubId: string;
  name: string;
  description: string;
  cover: Image;
  logo: Image;
  parentTeamId: string | null;
  parentTeam: Team | null;
  address: string;
  email: string;
  phone: string;
  discipline: string | null;
  federations: FederationShortConnection | null;
  coaches: UserShortConnection | null;
  members: UserShortConnection | null;
  friends: UserShortConnection | null;
  upcomingEventsCount: number;
  coacheInvitationsCount: number;
  memberInvitationsCount: number;
}

export interface MeInClub {
  role: TeamMemberType;
  status: TeamInvitationStatus;
  friends: UserShortConnection;
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

export interface UserShortConnection {
  items: UserShort[];
  totalCount: number;
}

export interface UserShort {
  id: string;
  name: string;
  logo: Image;
}

export interface UpdateTeamPrivateInput {
  id: string;
  clubId: string;
  name?: string;
  description?: string;
  cover?: string;
  logo?: string;
  parentTeamId?: string;
  address?: string;
  email?: string;
  phone?: string;
  discipline?: string;
  federations?: string[];
}

export interface UpdateTeamPrivatePayload {
  errors: string[];
  team: Team;
}

export interface FunctionEvent {
  arguments: {
    input: UpdateTeamPrivateInput;
    teamId: string;
    clubId: string;
    filter: TeamsFilterInput;
    limit?: number;
    from?: number;
  };
  identity: { sub: string };
  info: { fieldName: string };
}

export interface FunctionEventBatch {
  fieldName: string;
  source: any;
  identity: { sub: string; claims: any };
}

export interface TeamsFilterInput {
  search?: string;
  discipline?: string[];
  clubIds?: string[];
}

export interface TeamsConnection {
  items: Team[];
  totalCount: number;
}
