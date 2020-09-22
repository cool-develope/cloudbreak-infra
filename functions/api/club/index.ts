// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { Client } from '@elastic/elasticsearch';
// import DynamoHelper from '/opt/nodejs/dynamoHelper';
import { ClubModel } from './common-code/nodejs/models';
import { FieldName, FunctionEvent } from './common-code/nodejs/types/club';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN = '', ES_DOMAIN } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });

export const handler: Handler = async (event: FunctionEvent): Promise<any> => {
  const {
    arguments: { input, clubId, filter, limit, from },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;
  const clubModel = new ClubModel(db, MAIN_TABLE_NAME, IMAGES_DOMAIN, uuidv4, es);

  if (field === FieldName.createClubPrivate) {
    return await clubModel.create(sub, input);
  } else if (field === FieldName.updateClubPrivate) {
    return await clubModel.update(sub, input);
  } else if (field === FieldName.club) {
    return await clubModel.getById(clubId);
  } else if (field === FieldName.clubs) {
    return await clubModel.list(sub, filter, limit, from);
  }

  throw Error('Query not supported');
};
