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
      arguments: { filter, limit, from },
      identity: { sub },
      info: { fieldName },
    } = event;

    const field = fieldName as FieldName;

    if (field === FieldName.usersPrivate) {
      return await userModel.list(sub, filter, limit, from);
    } else if (field === FieldName.userPrivate) {
      return await userModel.getById(sub);
    }
  }

  throw Error('Query not supported');
};
