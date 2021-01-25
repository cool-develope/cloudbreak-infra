import { Handler } from 'aws-lambda';
import {
  FieldName,
  FunctionEvent,
  CreateQrPaymentCategoryInput,
  UpdateQrPaymentCategoryInput,
  DeleteQrPaymentCategoryInput,
} from './types';
import QrPaymentCategory from './qrPaymentCategory';

const { MAIN_TABLE_NAME, AWS_REGION = '' } = process.env;
const qrPaymentCategory = new QrPaymentCategory(AWS_REGION, MAIN_TABLE_NAME);

export const handler: Handler = async (event: FunctionEvent): Promise<any> => {
  const {
    arguments: { input, clubId },
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
    }
  } catch (error) {
    return error;
  }

  throw Error('Query not supported');
};
