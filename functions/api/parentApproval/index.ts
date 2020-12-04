// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

// @ts-ignore
import { FieldName, FunctionEvent } from './types';
import ParentApproval from './parentApproval';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN = '' } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const eventbridge = new AWS.EventBridge();
const parentApproval = new ParentApproval(db, MAIN_TABLE_NAME, IMAGES_DOMAIN, eventbridge);

export const handler: Handler = async (event: FunctionEvent): Promise<any> => {
  const {
    arguments: { input, type, id, childUserId },
    identity: { sub },
    info: { fieldName },
  } = event;

  /**
   * TODO: Deprecated - can be deleted.
   */

  if (fieldName === FieldName.approveAsParent) {
    return await parentApproval.approve(sub, input);
  } else if (fieldName === FieldName.rejectAsParent) {
    return await parentApproval.reject(sub, input);
  } else if (fieldName === FieldName.checkParentApproval) {
    return await parentApproval.get(childUserId, type, id);
  }

  throw Error('Query not supported');
};
