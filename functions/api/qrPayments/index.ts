import { Handler } from 'aws-lambda';
import {
  FieldName,
  FunctionEvent,
  EventBatchQrPayment,
  CreateQrPaymentCategoryInput,
  UpdateQrPaymentCategoryInput,
  DeleteQrPaymentCategoryInput,
  CreateQrPaymentInput,
  DeleteQrPaymentInput,
  QrPaymentsFilterInput,
} from './types';
import QrPaymentCategory from './qrPaymentCategory';
import QrPayment from './qrPayment';

const {
  MAIN_TABLE_NAME='',
  AWS_REGION = '',
  IMAGES_DOMAIN = '',
  IMAGES_BUCKET_NAME = '',
} = process.env;

const qrPaymentCategory = new QrPaymentCategory(AWS_REGION, MAIN_TABLE_NAME);
const qrPayment = new QrPayment(AWS_REGION, MAIN_TABLE_NAME, IMAGES_BUCKET_NAME, IMAGES_DOMAIN);

export const handler: Handler = async (
  event: FunctionEvent | EventBatchQrPayment[],
): Promise<any> => {
  if (Array.isArray(event)) {
    const fieldName = event[0]?.fieldName;

    try {
      if (fieldName === FieldName.batchQrPaymentCategory) {
        return await qrPaymentCategory.batchCategory(event);
      } else if (fieldName === FieldName.batchQrPaymentTransactions) {
        return await qrPayment.batchTransactions(event);
      }
    } catch (error) {
      return error;
    }
  } else {
    const {
      arguments: { input, clubId, id, filter },
      identity,
      info: { fieldName },
    } = event;

    try {
      if (fieldName === FieldName.createQrPaymentCategory) {
        return await qrPaymentCategory.create(identity, input as CreateQrPaymentCategoryInput);
      } else if (fieldName === FieldName.updateQrPaymentCategory) {
        return await qrPaymentCategory.update(identity, input as UpdateQrPaymentCategoryInput);
      } else if (fieldName === FieldName.deleteQrPaymentCategory) {
        return await qrPaymentCategory.delete(identity, input as DeleteQrPaymentCategoryInput);
      } else if (fieldName === FieldName.qrPaymentCategories) {
        return await qrPaymentCategory.list(clubId);
      } else if (fieldName === FieldName.createQrPayment) {
        return await qrPayment.create(identity, input as CreateQrPaymentInput);
      } else if (fieldName === FieldName.deleteQrPayment) {
        return await qrPayment.delete(identity, input as DeleteQrPaymentInput);
      } else if (fieldName === FieldName.qrPayment) {
        return await qrPayment.retrieve(identity, clubId, id);
      } else if (fieldName === FieldName.qrPayments) {
        return await qrPayment.list(identity, filter as QrPaymentsFilterInput);
      }
    } catch (error) {
      return error;
    }
  }

  throw Error('Query not supported');
};
