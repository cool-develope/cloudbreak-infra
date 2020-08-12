// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

const db = new AWS.DynamoDB.DocumentClient();

enum MutationName {
  signinMobile = 'signinMobile',
  signoutMobile = 'signoutMobile',
}

const updateItemSet = (pk: string, sk: string, deviceId: string, isAdd: boolean = true) => {
  const params = {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { pk, sk },
    UpdateExpression: `${isAdd ? 'ADD' : 'DELETE'} ids :id`,
    ExpressionAttributeValues: {
      ':id': db.createSet([deviceId]),
    },
  };

  return db.update(params).promise();
};

export const handler: Handler = async (event) => {
  const {
    arguments: {
      input: { deviceId },
    },
    identity: { sub },
    info: { fieldName },
  } = event;

  const mutation = fieldName as MutationName;
  const isAdd = mutation === MutationName.signinMobile;

  if (deviceId) {
    await updateItemSet(sub, 'devices', deviceId, isAdd);
  }

  return {
    errors: [],
  };
};
