export enum FieldName {
  clubCoaches = 'clubCoaches',
  clubMembers = 'clubMembers',
  clubFriends = 'clubFriends',
  teamCoaches = 'teamCoaches',
  teamMembers = 'teamMembers',
  teamFriends = 'teamFriends',
  userPrivate = 'userPrivate',
  usersPrivate = 'usersPrivate',
  updateUserPrivate = 'updateUserPrivate',
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

export enum OrganizationType {
  Federation = 'Federation',
  Club = 'Club',
}

export enum OrganizationRole {
  Owner = 'Owner',
  Coach = 'Coach',
}

export enum Gender {
  M,
  F,
}

export interface Image {
  url: string;
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

export interface UsersFilter {
  search?: string;
  clubIds?: string[];
  teamIds?: string[];
  userIds?: string[];
  hasWallet?: boolean;
  role?: TeamMemberType;
  status?: TeamInvitationStatus;
  createDateAfter?: string;
  createDateBefore?: string;
  birthDateAfter?: string;
  birthDateBefore?: string;
}

export interface FunctionEvent {
  arguments: {
    userId: string;
    filter: UsersFilter;
    limit: number;
    from: number;
    input: UpdateUserPrivateInput;
  };
  identity: { sub: string };
  info: { fieldName: FieldName };
}

export interface UpdateUserPrivateInput {
  userId: string;
  firstName: string;
  lastName: string;
  photo: string;
  birthDate: string;
  gender: Gender;
}

export interface FunctionEventBatch {
  fieldName: FieldName;
  source: any;
  identity: { sub: string; claims: any };
}

export interface EsUserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country?: string;
  photo?: string;
  phone?: string;
  phoneCountry?: string;
  birthDate?: string;
  birthCountry?: string;
  birthCity?: string;
  gender?: string;
  usCitizen?: boolean;
  city?: string;
  postcode?: string;
  address1?: string;
  address2?: string;
  kycReview: string;
  treezorUserId?: string;
  treezorWalletId?: string;
  teams:
    | {
        clubId: string;
        teamId: string;
        role: string;
      }[]
    | null;
}

export interface UserChild {
  firstName: string;
  lastName: string;
  photo: Image;
  phone: string;
  email: string;
  birthDate: string;
  gender: string;
  treezor: TreezorUser;
}

export interface UserPrivate {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  photo: Image;
  phone: string;
  phoneCountry: string;
  birthDate: string;
  birthCountry: string;
  birthCity: string;
  gender: Gender;
  usCitizen: Boolean;
  city: string;
  postcode: string;
  address1: string;
  address2: string;
  createDate: string;
  parent: UserChild | null;
  children: UserChild[];
  organization: Organization | null;
  treezor: TreezorUser;
  teams: TeamMemberDetails[];
}

export interface TreezorUser {
  userId: number | null;
  walletId: number | null;
}

export interface UsersPrivateConnection {
  items: UserPrivate[];
  totalCount: number;
}

export interface TeamMemberDetails {
  club: TeamShort;
  team: TeamShort;
  federation: TeamShort[];
  role: TeamMemberType;
  status: TeamInvitationStatus;
}

export interface TeamShort {
  id: string;
  name: string;
  logo: Image;
}

export interface Organization {
  type: OrganizationType;
  role: OrganizationRole;
  id: String;
  name: String;
  logo: Image;
}
