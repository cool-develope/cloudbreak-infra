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

export enum TransferType {
  Event,
  P2P,
  QrPayment,
}

export enum KycReview {
  NONE = '0',
  PENDING = '1',
  VALIDATED = '2',
  REFUSED = '3',
}

export interface Webhook {
  webhook: WebhookEvent;
  webhook_id: string;
  object: string;
  object_id: string;
  object_payload: any;
  object_payload_signature: string;
  auth_key: string;
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

export interface Card {
  cardId: string;
  userId: string;
  walletId: string;
  walletCardtransactionId: string;
  mccRestrictionGroupId: string | null;
  merchantRestrictionGroupId: string | null;
  countryRestrictionGroupId: string | null;
  eventName: string;
  eventAlias: string;
  publicToken: string;
  cardTag: string;
  statusCode: string;
  isLive: string;
  pinTryExceeds: string;
  maskedPan: string;
  embossedName: string;
  expiryDate: string;
  CVV: string;
  startDate: string;
  endDate: string;
  countryCode: string;
  currencyCode: string;
  deliveryTitle: string;
  deliveryLastname: string;
  deliveryFirstname: string;
  deliveryAddress1: string;
  deliveryAddress2: string;
  deliveryAddress3: string;
  deliveryCity: string;
  deliveryPostcode: string;
  deliveryCountry: string;
  mobileSent: string;
  limitsGroup: string;
  permsGroup: string;
  cardDesign: string;
  virtualConverted: string;
  optionAtm: string;
  optionForeign: string;
  optionOnline: string;
  optionNfc: string;
  limitAtmYear: string;
  limitAtmMonth: string;
  limitAtmWeek: string;
  limitAtmDay: string;
  limitAtmAll: string;
  limitPaymentYear: string;
  limitPaymentMonth: string;
  limitPaymentWeek: string;
  limitPaymentDay: string;
  paymentDailyLimit: string;
  restrictionGroupLimits: null;
  limitPaymentAll: string;
  totalAtmYear: string;
  totalAtmMonth: string;
  totalAtmWeek: string;
  totalAtmDay: string;
  totalAtmAll: string;
  totalPaymentYear: string;
  totalPaymentMonth: string;
  totalPaymentWeek: string;
  totalPaymentDay: string;
  totalPaymentAll: string;
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  modifiedDate: string;
  cancellationNumber: string | null;
  physical: string;
}

export enum TransferTypeId {
  WalletToWallet = 1,
  ClientFees = 3,
  CreditNote = 4,
}

export interface TransferBody {
  walletId: number;
  beneficiaryWalletId: number;
  transferTag: string;
  label: string;
  amount: number;
  currency: 'EUR';
  transferTypeId: TransferTypeId;
}
