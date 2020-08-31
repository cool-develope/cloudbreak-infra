// @ts-ignore
import * as AWS from 'aws-sdk';
import { CognitoUserPoolTriggerHandler } from 'aws-lambda';

const eventbridge = new AWS.EventBridge();
const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME } = process.env;

const putEvents = (type: string, detail: any) => {
  const params = {
    Entries: [
      {
        Source: 'custom.cognito',
        EventBusName: 'default',
        Time: new Date(),
        DetailType: type,
        Detail: JSON.stringify(detail),
      },
    ],
  };

  console.log(type, detail);
  return eventbridge.putEvents(params).promise();
};

const getItem = (pk: string, sk: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: { pk, sk },
  };

  return db.get(params).promise();
};

export const handler: CognitoUserPoolTriggerHandler = async (event) => {
  const {
    userPoolId,
    request: { userAttributes },
  } = event;

  const detail = { userPoolId, userAttributes };
  const pk = `user#${userAttributes.sub}`;
  const { Item } = await getItem(pk, 'metadata');
  const userExist = Item && Item.pk;

  const eventType = userExist ? 'signin' : 'signup';
  await putEvents(eventType, detail);

  return event;
};
