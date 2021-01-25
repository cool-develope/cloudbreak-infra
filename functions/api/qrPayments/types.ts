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

export interface QrPaymentCategory {
  id: string;
  clubId: string;
  name: string;
  image: string;
  vatFee: number;
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

export enum FieldName {
  createQrPaymentCategory = 'createQrPaymentCategory',
  updateQrPaymentCategory = 'updateQrPaymentCategory',
  deleteQrPaymentCategory = 'deleteQrPaymentCategory',
  qrPaymentCategories = 'qrPaymentCategories',
}

export interface FunctionEvent {
  arguments: {
    input:
      | CreateQrPaymentCategoryInput
      | UpdateQrPaymentCategoryInput
      | DeleteQrPaymentCategoryInput;
    clubId: string;
  };
  identity: CognitoIdentity;
  info: { fieldName: FieldName };
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
