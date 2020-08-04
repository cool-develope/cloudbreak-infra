// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

const db = new AWS.DynamoDB.DocumentClient();

const query = (pk: string) => {
  const params = {
    TableName: 'Dictionary',
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': pk,
    },
  };

  return db.query(params).promise();
};

export const handler: Handler = async (event, context, callback) => {
  switch (event.field) {
    case 'countries': {
      const data = await query('country');
      const result = data.Items.map((item: any) => ({
        code: item.sk,
        name: item.name,
        native: item.native,
        phone: item.phone,
      }));

      callback(null, result);
      break;
    }

    case 'languages': {
      const data = await query('language');
      const result = data.Items.map((item: any) => ({
        code: item.sk,
        name: item.name,
        native: item.native,
      }));

      callback(null, result);
      break;
    }

    default:
      callback('Unknown field, unable to resolve' + event.field, null);
      break;
  }
};
