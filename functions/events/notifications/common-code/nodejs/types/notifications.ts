export enum FieldName {
  notifications = 'notifications',
}

export enum NotificationType {
  SendTeamInvitation = 'SendTeamInvitation',
  DeclineTeamInvitation = 'DeclineTeamInvitation',
  AcceptTeamInvitation = 'AcceptTeamInvitation',
  AcceptTeamInvitationToParent = 'AcceptTeamInvitationToParent',
  DeclineTeamInvitationToParent = 'DeclineTeamInvitationToParent',
  SendMoneyRequest = 'SendMoneyRequest',
  RejectMoneyRequest = 'RejectMoneyRequest',
  ApproveMoneyRequest = 'ApproveMoneyRequest',
  InviteParent = 'InviteParent',
  AcceptChildInvitation = 'AcceptChildInvitation',
  DeclineChildInvitation = 'DeclineChildInvitation',
  KycReview = 'KycReview',
  ChildKycReview = 'ChildKycReview',
  ChildSendMoneyRequest = 'ChildSendMoneyRequest',
  AcceptedPaidEvent = 'AcceptedPaidEvent',
  ChildAcceptedPaidEvent = 'ChildAcceptedPaidEvent',
  CardLockChanged = 'CardLockChanged',
  CardLimitChanged = 'CardLimitChanged',
  ChildSendTeamInvitation = 'ChildSendTeamInvitation',
  ApproveTeamInvitationByParent = 'ApproveTeamInvitationByParent',
  RejectTeamInvitationByParent = 'RejectTeamInvitationByParent',
  ChildReceivedMoney = 'ChildReceivedMoney',
  ReceivedMoney = 'ReceivedMoney',
  ChildSendMoney = 'ChildSendMoney',
  SendMoney = 'SendMoney',
}

export enum WebhookEvent {
  card_options = 'card.options',
  card_setpin = 'card.setpin',
  card_unblockpin = 'card.unblockpin',
  card_lockunlock = 'card.lockunlock',
  card_requestphysical = 'card.requestphysical',
  card_createvirtual = 'card.createvirtual',
  card_convertvirtual = 'card.convertvirtual',
  card_changepin = 'card.changepin',
  card_activate = 'card.activate',
  card_renew = 'card.renew',
  card_regenerate = 'card.regenerate',
  card_update = 'card.update',
  card_limits = 'card.limits',
  payin_create = 'payin.create',
  payin_update = 'payin.update',
  payin_cancel = 'payin.cancel',
  payout_create = 'payout.create',
  payout_update = 'payout.update',
  payout_cancel = 'payout.cancel',
  payinrefund_create = 'payinrefund.create',
  payinrefund_update = 'payinrefund.update',
  payinrefund_cancel = 'payinrefund.cancel',
  transaction_create = 'transaction.create',
  cardtransaction_create = 'cardtransaction.create',
  transfer_create = 'transfer.create',
  transfer_update = 'transfer.update',
  transfer_cancel = 'transfer.cancel',
  transferrefund_create = 'transferrefund.create',
  transferrefund_update = 'transferrefund.update',
  transferrefund_cancel = 'transferrefund.cancel',
  user_create = 'user.create',
  user_update = 'user.update',
  user_cancel = 'user.cancel',
  user_kycreview = 'user.kycreview',
  user_kycrequest = 'user.kycrequest',
  wallet_create = 'wallet.create',
  wallet_update = 'wallet.update',
  wallet_cancel = 'wallet.cancel',
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

export enum EmailType {
  InviteParent,
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
  parentSub?: string | null;
  teamId: string;
  clubId: string;
  childFirstName?: string;
  childLastName?: string;
  childPhoto?: string | null;
  parentFirstName?: string;
  parentLastName?: string;
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
  childPhoto: string;
  parentSub: string;
  parentFirstName: string;
  parentLastName: string;
  parentPhoto: string;
}

export interface NotificationSendMoneyRequest {
  requestId: string;
  senderSub: string;
  senderEmail: string;
  senderFirstName: string;
  senderLastName: string;
  senderPhoto: string;
  senderWalletId: string;
  recipientSub: string;
  recipientEmail: string;
  recipientFirstName: string;
  recipientLastName: string;
  amount: string;
  note: string;
}

export interface NotificationRejectMoneyRequest {
  requestId: string;
  senderSub: string;
  recipientSub: string;
}

export enum TransferType {
  Event,
  P2P,
}

export interface Transfer {
  transferId: string;
  transferTypeId: string;
  transferTag: string;
  transferStatus: string;
  walletId: string;
  foreignId: string;
  walletTypeId: string;
  beneficiaryWalletId: string;
  beneficiaryWalletTypeId: string;
  transferDate: string;
  amount: string;
  currency: string;
  label: string;
  partnerFee: string;
  createdDate: string;
  modifiedDate: string;
  walletEventName: string;
  walletAlias: string;
  beneficiaryWalletEventName: string;
  beneficiaryWalletAlias: string;
  codeStatus: string;
  informationStatus: string;
}
