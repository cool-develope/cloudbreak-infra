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

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN = '',
  ES_DOMAIN,
  COGNITO_USERPOOL_ID = '',
} = process.env;

const db = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();
const es = new Client({ node: ES_DOMAIN });

export const handler: Handler = async (event: FunctionEvent): Promise<any> => {
  const {
    arguments: { input, clubId, filter, limit, from },
    identity: { sub, claims },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;
  const clubModel = new ClubModel(
    db,
    MAIN_TABLE_NAME,
    IMAGES_DOMAIN,
    uuidv4,
    es,
    cognito,
    COGNITO_USERPOOL_ID,
  );

  if (field === FieldName.createClubPrivate) {
    return await clubModel.create(claims, input);
  } else if (field === FieldName.updateClubPrivate) {
    return await clubModel.update(claims, input);
  } else if (field === FieldName.club) {
    return await clubModel.getById(clubId);
  } else if (field === FieldName.clubs || field === FieldName.clubsPrivate) {
    return await clubModel.list(sub, filter, limit, from);
  }

  throw Error('Query not supported');
};
