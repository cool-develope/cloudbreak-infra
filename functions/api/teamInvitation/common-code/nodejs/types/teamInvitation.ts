export enum FieldName {
  sendTeamInvitation = 'sendTeamInvitation',
  acceptTeamInvitationPrivate = 'acceptTeamInvitationPrivate',
  declineTeamInvitationPrivate = 'declineTeamInvitationPrivate',
  changeTeamRolePrivate = 'changeTeamRolePrivate',
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

export interface SendTeamInvitationInput {
  clubId: string;
  teamId: string;
  role: TeamMemberType;
}

export interface AcceptTeamInvitationPrivateInput {
  userId: string;
  clubId: string;
  teamId: string;
}

export interface DeclineTeamInvitationPrivateInput {
  userId: string;
  clubId: string;
  teamId: string;
}

export interface ChangeTeamRolePrivateInput {
  userId: string;
  clubId: string;
  teamId: string;
  role: TeamMemberType;
}

export interface SendTeamInvitationPayload {
  errors: string[];
}

export interface FunctionEvent {
  arguments: {
    input: any;
  };
  identity: { sub: string };
  info: { fieldName: string };
}

export interface TeamUserRecord {
  role: TeamMemberType;
  createdAt: string;
  clubId: string;
  status: TeamInvitationStatus;
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
  discipline?: string | null;
  federations?: string[];
  ownerUserId?: string;
  modifiedAt?: string;
}

export interface NotificationTeamInvitation {
  sub: string;
  teamId: string;
  clubId: string;
  teamName: string;
  teamLogo: string;
  role?: TeamMemberType;
  fromRole?: TeamMemberType;
  toRole?: TeamMemberType;
}
