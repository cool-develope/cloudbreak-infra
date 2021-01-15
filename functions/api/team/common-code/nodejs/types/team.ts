export enum FieldName {
  createTeamPrivate = 'createTeamPrivate',
  updateTeamPrivate = 'updateTeamPrivate',
  team = 'team',
  teamsPrivate = 'teamsPrivate',
  parentTeam = 'parentTeam',
  childrenTeams = 'childrenTeams',
  clubTeams = 'clubTeams',
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
  PendingParentApproval = 'PendingParentApproval',
  ParentRejected = 'ParentRejected',
}

export interface Image {
  url: string;
}

export interface TeamRecord {
  pk?: string;
  sk?: string;
  name?: string;
  description?: string;
  cover?: string | null;
  logo?: string | null;
  parentTeamId?: string | null;
  address?: string;
  email?: string;
  phone?: string;
  discipline?: string | null;
  federations?: string[];
  ownerUserId?: string;
  modifiedAt?: string;
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
  federations?: FederationShortConnection | null | string[];
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
  parentTeamId?: string | null;
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
  identity: { sub: string; claims: CognitoClaims };
  info: { fieldName: string };
}

export interface FunctionEventBatch {
  fieldName: string;
  source: any;
  identity: { sub: string; claims: CognitoClaims };
}

export interface TeamsFilterInput {
  search?: string;
  discipline?: string[];
  clubIds?: string[];
  parentTeamId?: string | null;
  isParent?: boolean;
}

export interface TeamsConnection {
  items: Team[];
  totalCount: number;
}

export interface CognitoClaims {
  sub: string;
  aud: string;
  token_use: string;
  email: string;
  'cognito:groups': string[];
  'cognito:username': string;
  'custom:trzUserId': string;
  'custom:clubs': string;
  'custom:federations': string;
  'custom:trzWalletsId': string;
  'custom:trzScopes': string;
  'custom:trzCardsId': string;
  'custom:trzChildren': string;
}
