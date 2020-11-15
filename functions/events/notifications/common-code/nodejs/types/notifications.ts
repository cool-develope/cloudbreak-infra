export enum FieldName {
  notifications = 'notifications',
}

export enum NotificationType {
  SendTeamInvitation = 'SendTeamInvitation',
  DeclineTeamInvitation = 'DeclineTeamInvitation',
  AcceptTeamInvitation = 'AcceptTeamInvitation',
  SendMoneyRequest = 'SendMoneyRequest',
  InviteParent = 'InviteParent',
  AcceptChildInvitation = 'AcceptChildInvitation',
  DeclineChildInvitation = 'DeclineChildInvitation',
  KycReview = 'KycReview',
  ChildSendMoneyRequest = 'ChildSendMoneyRequest',
  AcceptedPaidEvent = 'AcceptedPaidEvent',
  ChildAcceptedPaidEvent = 'ChildAcceptedPaidEvent',
}

export enum KycStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REFUSED = 'REFUSED',
}

export enum TeamMemberType {
  Member = 'Member',
  Coach = 'Coach',
}

export interface NotificationInput {
  type: string | NotificationType;
  attributes: KeyValue[];
}

export interface NotificationRecord {
  pk?: string;
  sk?: string;
  type: string;
  attributes: KeyValue[];
  createdAt: string;
}

export interface KeyValue {
  Key: string;
  Value: string;
}

export interface NotificationsConnection {
  items: Notification[];
}

export interface Notification {
  id: string;
  createDate: string;
  type: NotificationType;
  attributes: KeyValue[];
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

export interface NotificationKycReview {
  sub: string;
  status: KycStatus;
}

export interface NotificationInviteParent {
  invitationUrl: string;
  childSub: string;
  childEmail: string;
  childFirstName: string;
  childLastName: string;
  childPhoto: string;
  childBirthDate: string;
  childParentSub: string;
  parentEmail: string;
}

export interface NotificationChildInvitation {
  childSub: string;
  childFirstName: string;
  childLastName: string;
  childBirthDate: string;
  parentSub: string;
  parentFirstName: string;
  parentLastName: string;
}

export interface NotificationSendMoneyRequest {
  senderSub: string;
  senderEmail: string;
  senderFirstName: string;
  senderLastName: string;
  senderPhoto: string;
  recipientSub: string;
  recipientEmail: string;
  recipientFirstName: string;
  recipientLastName: string;
  amount: string;
  note: string;
}
