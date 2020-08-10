// @ts-ignore
import * as AWS from 'aws-sdk';
import { CognitoUserPoolTriggerHandler } from 'aws-lambda';

const eventbridge = new AWS.EventBridge();

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

export const handler: CognitoUserPoolTriggerHandler = async (event) => {
  const {
    userPoolId,
    request: { userAttributes },
  } = event;

  const detail = { userPoolId, userAttributes };
  const hasTreezorUserId = 'cognito:trzUserId' in userAttributes;

  if (hasTreezorUserId) {
    await putEvents('signin', detail);
  } else {
    await putEvents('signup', detail);
  }

  return event;
};
