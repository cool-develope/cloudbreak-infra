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
  invitationId: string;
  clubId: string;
  teamId: string;
}

export interface DeclineTeamInvitationPrivateInput {
  invitationId: string;
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

export interface TeamInvitationRecord {
  role: TeamMemberType;
  createdAt: string;
  status: TeamInvitationStatus;
}

export interface TeamUserRecord {
  role: TeamMemberType;
  createdAt: string;
  clubId: string;
}
