export enum FieldName {
  sendTeamInvitation = 'sendTeamInvitation',
  acceptTeamInvitationPrivate = 'acceptTeamInvitationPrivate',
  declineTeamInvitationPrivate = 'declineTeamInvitationPrivate',
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
