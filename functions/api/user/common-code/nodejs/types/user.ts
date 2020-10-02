export enum FieldName {
  clubCoaches = 'clubCoaches',
  clubMembers = 'clubMembers',
  clubFriends = 'clubFriends',
  teamCoaches = 'teamCoaches',
  teamMembers = 'teamMembers',
  teamFriends = 'teamFriends',
  userPrivate = 'userPrivate',
  usersPrivate = 'usersPrivate',
}

export enum TeamMemberType {
  Member = 'Member',
  Coach = 'Coach',
}

export enum TeamInvitationStatus {
  None = 'None',
  Pending = 'Pending',
  Accepted = 'Accepted',
  Declined = 'Declined',
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
  role?: TeamMemberType;
  status?: TeamInvitationStatus;
}

export interface FunctionEvent {
  arguments: {
    filter: UsersFilter;
    limit: number;
    from: number;
  };
  identity: { sub: string };
  info: { fieldName: string };
}

export interface FunctionEventBatch {
  fieldName: string;
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
  teams: TeamMemberDetails[];
}

export interface UsersPrivateConnection {
  items: UserPrivate[];
  totalCount: number;
}

export interface TeamMemberDetails {
  club: TeamShort;
  team: TeamShort;
  role: TeamMemberType;
  status: TeamInvitationStatus;
}

export interface TeamShort {
  id: string;
  name: string;
  logo: Image;
}
