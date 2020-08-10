import { CognitoUserPoolTriggerHandler } from 'aws-lambda';

export const handler: CognitoUserPoolTriggerHandler = async (event) => {
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
};
