export interface CreateQrPaymentCategoryInput {
  clubId: string;
  name: string;
  image?: string;
  vatFee?: number;
}
export interface UpdateQrPaymentCategoryInput {
  id: string;
  clubId: string;
  name?: string;
  image?: string;
}
export interface DeleteQrPaymentCategoryInput {
  id: string;
  clubId: string;
}

export interface CreateQrPaymentInput {
  clubId: string;
  categoryId: string;
  amount: number;
  description: string;
  images: string[];
}

export interface DeleteQrPaymentInput {
  id: string;
  clubId: string;
}

export interface QrPaymentsFilterInput {
  clubId: string;
  categoryId: string;
}

export interface CreateQrPaymentCategoryPayload {
  errors: string[];
  category?: QrPaymentCategory;
}
export interface UpdateQrPaymentCategoryPayload {
  errors: string[];
  category?: QrPaymentCategory;
}
export interface DeleteQrPaymentCategoryPayload {
  errors: string[];
}

export interface CreateQrPaymentPayload {
  errors: string[];
  payment: QrPayment;
}

export interface DeleteQrPaymentPayload {
  errors: string[];
}

export interface QrPaymentsConnection {
  items: QrPayment[];
}

export interface QrPaymentCategory {
  id: string;
  name: string;
  image: Image;
  vatFee: number;
}

export interface QrPayment {
  id: string;
  club: Partial<ClubShort> | null;
  category: Partial<QrPaymentCategory> | null;
  createdBy: Partial<UserPublic> | null;
  amount: number;
  description: string;
  images: string[];
  qrCode: QrCode;
  createDate: string;
}

export interface Image {
  url: string;
}

export interface QrCode {
  url: string;
}

export interface QrPaymentTransaction {
  user: UserPublic;
  createDate: string;
}

export interface UserPublic {
  id: string;
  firstName: string;
  lastName: string;
  photo?: Image;
}

export interface ClubShort {
  id: string;
  name: string;
  logo: Image;
}

export interface QrPaymentCategoryDBItem {
  pk: string;
  sk: string;
  name: string;
  image: string;
  vatFee: number;
  createdAt: string;
  modifiedAt: string;
}

export interface QrPaymentDBItem {
  pk: string;
  sk: string;
  categoryId: string;
  amount: number;
  description: string;
  images: string[];
  qrCode: string;
  createdAt: string;
  createdByUser: string;
}

export interface QrPaymentTransactionDBItem {
  pk: string;
  sk: string;
  treezorTransferId: number;
  createdAt: string;
  status: string;
}

export enum FieldName {
  createQrPaymentCategory = 'createQrPaymentCategory',
  updateQrPaymentCategory = 'updateQrPaymentCategory',
  deleteQrPaymentCategory = 'deleteQrPaymentCategory',
  qrPaymentCategories = 'qrPaymentCategories',
  createQrPayment = 'createQrPayment',
  deleteQrPayment = 'deleteQrPayment',
  qrPayment = 'qrPayment',
  qrPayments = 'qrPayments',
  batchQrPaymentCategory = 'batchQrPaymentCategory',
  batchQrPaymentTransactions = 'batchQrPaymentTransactions',
}

export interface FunctionEvent {
  arguments: {
    input:
      | CreateQrPaymentCategoryInput
      | UpdateQrPaymentCategoryInput
      | DeleteQrPaymentCategoryInput
      | CreateQrPaymentInput
      | DeleteQrPaymentInput;
    clubId: string;
    id: string;
    filter: QrPaymentsFilterInput;
  };
  identity: CognitoIdentity;
  info: { fieldName: FieldName };
}

export interface EventBatchQrPayment {
  fieldName: FieldName;
  source: QrPayment;
  identity: CognitoIdentity;
}
export interface CognitoIdentity {
  sub: string;
  claims: CognitoClaims;
}

export interface CognitoClaims {
  sub: string;
  aud: string;
  token_use: string;
  email: string;
  'cognito:groups': string[];
  'cognito:username': string;
  'custom:trzUserId': string;
  'custom:clubs': string;
  'custom:trzWalletsId': string;
  'custom:trzScopes': string;
  'custom:trzCardsId': string;
  'custom:trzChildren': string;
}
