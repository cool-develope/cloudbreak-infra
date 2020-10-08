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
}

export interface NotificationInput {
  type: string;
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
