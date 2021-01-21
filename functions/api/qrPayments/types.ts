export interface CreateQrPaymentCategoryInput {}
export interface UpdateQrPaymentCategoryInput {}
export interface DeleteQrPaymentCategoryInput {}

export interface CreateQrPaymentCategoryPayload {}
export interface UpdateQrPaymentCategoryPayload {}
export interface DeleteQrPaymentCategoryPayload {}

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
  identity: { sub: string };
  info: { fieldName: FieldName };
}
