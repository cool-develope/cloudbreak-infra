// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

export enum FieldName {
  addLike = 'addLike',
  removeLike = 'removeLike',
  acceptEvent = 'acceptEvent',
  declineEvent = 'declineEvent',
}

const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME = '' } = process.env;

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
    // ReturnValues: 'ALL_NEW',
  };

  return db.update(params).promise();
};

export const handler: Handler = async (event): Promise<{ eventId: string }> => {
  const {
    arguments: {
      input: { eventId },
    },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;
  const pk = `event#${eventId}`;
  const sk = `user#${sub}`;

  if (field === FieldName.addLike) {
    await updateItem(pk, sk, { l: true });
  } else if (field === FieldName.removeLike) {
    await updateItem(pk, sk, { l: false });
  } else if (field === FieldName.acceptEvent) {
    await updateItem(pk, sk, { a: true });
  } else if (field === FieldName.declineEvent) {
    await updateItem(pk, sk, { a: false });
  }

  return { eventId };
};
