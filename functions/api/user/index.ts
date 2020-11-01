// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { Client } from '@elastic/elasticsearch';
import { UserModel } from './common-code/nodejs/models';
import { FieldName, FunctionEvent, FunctionEventBatch } from './common-code/nodejs/types/user';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN = '', ES_DOMAIN } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });

export const handler: Handler = async (
  event: FunctionEvent | FunctionEventBatch[],
): Promise<any> => {
  const userModel = new UserModel(db, MAIN_TABLE_NAME, IMAGES_DOMAIN, uuidv4, es);

  if (Array.isArray(event)) {
    /**
     * Batch
     */
    return await userModel.listBatch(event);
  } else {
    const {
      arguments: { filter, limit, from, userId, input },
      identity: { sub },
      info: { fieldName },
    } = event;

    if (fieldName === FieldName.usersPrivate) {
      return await userModel.list(sub, filter, limit, from);
    } else if (fieldName === FieldName.userPrivate) {
      return await userModel.getById(userId);
    } else if (fieldName === FieldName.updateUserPrivate) {
      return await userModel.updateUserPrivate(sub, input);
    }
  }

  throw Error('Query not supported');
};
