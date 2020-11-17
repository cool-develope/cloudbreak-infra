export enum FieldName {
  updateUser = 'updateUser',
  me = 'me',
  setPin = 'setPin',
  verifyPin = 'verifyPin',
  changePin = 'changePin',
}

export enum Gender {
  M,
  F,
}

export enum OrganizationType {
  Federation = 'Federation',
  Club = 'Club',
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

export enum OrganizationRole {
  Owner = 'Owner',
  Coach = 'Coach',
}

export enum KycReview {
  NONE = 'NONE',
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REFUSED = 'REFUSED',
}

export interface Image {
  url: string;
}

export interface UpdateUserInput {
  pk?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  photo?: string;
  birthDate?: string;
  birthCountry?: string;
  birthCity?: string;
  gender?: Gender;
  usCitizen?: boolean;
  city?: string;
  postcode?: string;
  address1?: string;
  address2?: string;
  language?: string;
}

export interface UserChild {
  id: string;
  firstName: string;
  lastName: string;
  photo: Image;
  phone: string;
  email: string;
  birthDate: string;
  gender: string;
  treezor: TreezorUser;
}

export interface TreezorUser {
  userId: number;
  walletId: number;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country?: string;
  photo?: Image;
  phone?: string;
  language: string;
  phoneCountry?: string;
  birthDate?: string;
  birthCountry?: string;
  birthCity?: string;
  gender?: Gender;
  usCitizen?: boolean;
  city?: string;
  postcode?: string;
  address1?: string;
  address2?: string;
  children: UserChild[];
  parent: UserChild | null;
  pendingChildInvitations: ChildInvitation[];
  organization: Organization | null;
  treezor: TreezorUser;
  kycReview: KycReview;
  teams: TeamMember[];
}

export interface TeamMember {
  clubId: string;
  teamId: string;
  role: TeamMemberType;
  status: TeamInvitationStatus;
}

export interface ChildInvitation {
  invitationId: string;
  createDate: string;
  user: UserChild;
}

export interface TeamUserRecord {
  pk: string;
  sk: string;
  role: TeamMemberType;
  createdAt: string;
  clubId: string;
  status: TeamInvitationStatus;
}

export interface Organization {
  type: OrganizationType;
  role: OrganizationRole;
  id: String;
  name: String;
  logo: Image;
}

export interface SetPinPayload {
  errors: string[];
}

export interface VerifyPinPayload {
  errors: string[];
  verified: boolean;
}

export interface ChangePinPayload {
  errors: string[];
}
