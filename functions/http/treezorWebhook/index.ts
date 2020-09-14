// @ts-ignore
import * as AWS from 'aws-sdk';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import * as OneSignal from 'onesignal-node';

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN,
  ONESIGNAL_APP_ID = '',
  ONESIGNAL_API_KEY = '',
} = process.env;

const db = new AWS.DynamoDB.DocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { headers, body = '' } = event;
  let bodyJson = null;

  try {
    bodyJson = JSON.parse(body);
  } catch (err) {}

  console.log('EVENT', JSON.stringify(event, null, 2));
  console.log('BODY', JSON.stringify(bodyJson, null, 2));

  const response = {
    statusCode: 200,
  };

  return response;
};
