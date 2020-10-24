// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { validate as uuidValidate } from 'uuid';

const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME } = process.env;

enum MutationName {
  signinMobile = 'signinMobile',
  signoutMobile = 'signoutMobile',
}

const updateItemSet = (pk: string, sk: string, deviceId: string, isAdd: boolean = true) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
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
  const pk = `user#${sub}`;

  try {
    if (deviceId && uuidValidate(deviceId)) {
      await updateItemSet(pk, 'devices', deviceId, isAdd);
    }
  } catch (err) {
    console.error(err, deviceId);
  }

  return {
    errors: [],
  };
};
