export enum FieldName {
  clubCoaches = 'clubCoaches',
  clubMembers = 'clubMembers',
  clubFriends = 'clubFriends',
  teamCoaches = 'teamCoaches',
  teamMembers = 'teamMembers',
  teamFriends = 'teamFriends',
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

export interface FunctionEvent {
  arguments: any;
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
