// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

const db = new AWS.DynamoDB.DocumentClient();

enum QueryName {
  countries = 'countries',
  languages = 'languages',
}

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

export const handler: Handler = async (event) => {
  const {
    info: { fieldName },
  } = event;

  const queryName = fieldName as QueryName;

  switch (queryName) {
    case QueryName.countries: {
      const data = await query('country');
      const result = data.Items.map((item: any) => ({
        code: item.sk,
        name: item.name,
        native: item.native,
        phone: item.phone,
      }));

      return result;
    }

    case QueryName.languages: {
      const data = await query('language');
      const result = data.Items.map((item: any) => ({
        code: item.sk,
        name: item.name,
        native: item.native,
      }));

      return result;
    }

    default:
      return [];
  }
};
