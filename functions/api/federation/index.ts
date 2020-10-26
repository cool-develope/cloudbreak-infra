// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { Client } from '@elastic/elasticsearch';
import { FederationModel } from './common-code/nodejs/models';
import {
  FieldName,
  FunctionEvent,
  FunctionEventBatch,
} from './common-code/nodejs/types/federation';

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN = '',
  ES_DOMAIN,
  COGNITO_USERPOOL_ID = '',
} = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });
const cognito = new AWS.CognitoIdentityServiceProvider();

export const handler: Handler = async (
  event: FunctionEvent | FunctionEventBatch[],
): Promise<any> => {
  const federationModel = new FederationModel(
    db,
    MAIN_TABLE_NAME,
    IMAGES_DOMAIN,
    uuidv4,
    es,
    cognito,
    COGNITO_USERPOOL_ID,
  );
  console.log(JSON.stringify(event, null, 2));

  if (Array.isArray(event)) {
    /**
     * Batch
     */
    const field = event[0]?.fieldName as FieldName;
    if (field === FieldName.childrenFederation) {
      return await federationModel.getChildrenFederationBatch(event);
    }
  } else {
    const {
      arguments: { input, filter, limit, from, federationId },
      identity: { sub },
      info: { fieldName },
    } = event;

    if (fieldName === FieldName.createFederationPrivate) {
      return await federationModel.create(sub, input);
    } else if (fieldName === FieldName.updateFederationPrivate) {
      return await federationModel.update(sub, input);
    } else if (fieldName === FieldName.federation) {
      return await federationModel.getById(federationId || '');
    } else if (fieldName === FieldName.federationsPrivate) {
      return await federationModel.list(sub, filter, limit, from);
    }
  }

  throw Error('Query not supported');
};
