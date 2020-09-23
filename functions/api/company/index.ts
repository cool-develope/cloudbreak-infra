// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import { CompanyModel } from './common-code/nodejs/models';
import { FieldName, FunctionEvent } from './common-code/nodejs/types/comp';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN = '' } = process.env;
const db = new AWS.DynamoDB.DocumentClient();

export const handler: Handler = async (event: FunctionEvent): Promise<any> => {
  const {
    arguments: { input },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;
  const clubModel = new CompanyModel(db, MAIN_TABLE_NAME, IMAGES_DOMAIN, uuidv4);

  if (field === FieldName.createCompanyPrivate) {
    return await clubModel.create(sub, input);
  } else if (field === FieldName.updateCompanyPrivate) {
    return await clubModel.update(sub, input);
  } else if (field === FieldName.companyPrivate) {
    return await clubModel.getByUserId(sub);
  }

  throw Error('Query not supported');
};
