// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { Client } from '@elastic/elasticsearch';
import { NotificationsModel } from './common-code/nodejs/models';
import { FieldName } from './common-code/nodejs/types/notifications';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN = '', ES_DOMAIN } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });

export const handler: Handler = async (event): Promise<any> => {
  const notificationsModel = new NotificationsModel(db, MAIN_TABLE_NAME, IMAGES_DOMAIN, uuidv4, es);

  const {
    arguments: { limit },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;

  if (field === FieldName.notifications) {
    return await notificationsModel.list(sub, limit);
  }

  throw Error('Query not supported');
};
