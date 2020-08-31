// @ts-ignore
import * as AWS from 'aws-sdk';
import { EventBridgeHandler } from 'aws-lambda';

const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME } = process.env;

const getUpdateExpression = (attributes: any = {}) =>
  Object.keys(attributes)
    .map((key) =>
      attributes[key] !== undefined && attributes[key] !== null ? `${key} = :${key}` : null,
    )
    .filter((attr) => !!attr)
    .join(', ');

const getExpressionAttributeValues = (attributes = {}) => {
  const obj: any = {};
  Object.entries(attributes).forEach(([key, value]) =>
    value !== undefined && value !== null ? (obj[`:${key}`] = value) : null,
  );
  return obj;
};

const updateItem = (pk: string, sk: string, attributes: any) => {
  const condition = 'SET ' + getUpdateExpression(attributes);
  const values = getExpressionAttributeValues(attributes);

  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: { pk, sk },
    UpdateExpression: condition,
    ExpressionAttributeValues: values,
  };

  return db.update(params).promise();
};

export const handler: EventBridgeHandler<any, any, any> = async (event) => {
  const {
    detail: {
      userAttributes: { sub, email },
    },
  } = event;

  const pk = `user#${sub}`;
  const userData = {
    email,
    createdAt: new Date().toISOString(),
  };

  await updateItem(pk, 'metadata', userData);
};
