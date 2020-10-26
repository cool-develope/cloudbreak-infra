// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import DynamoHelper from './dynamoHelper';
import TreezorClient from './treezorClient';

enum FieldName {
  transactions = 'transactions',
}

interface TransactionsFilter {
  walletId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface CognitoClaims {
  sub: string;
  aud: string;
  token_use: string;
  email: string;
  'cognito:groups': string[];
  'cognito:username': string;
  'custom:trzUserId': string;
  'custom:clubs': string;
  'custom:trzWalletsId': string;
  'custom:trzScopes': string;
  'custom:trzCardsId': string;
  'custom:trzChildren': string;
}

interface FunctionEvent {
  arguments: {
    filter?: TransactionsFilter;
  };
  identity: { sub: string; claims: CognitoClaims; sourceIp: string[] };
  info: { fieldName: FieldName };
  request: {
    headers: { authorization: string };
  };
}

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN = '',
  ES_DOMAIN = '',
  COGNITO_USERPOOL_ID = '',
  TREEZOR_BASE_URL = '',
  TREEZOR_CLIENT_ID = '',
  TREEZOR_CLIENT_SECRET = '',
} = process.env;

const cognito = new AWS.CognitoIdentityServiceProvider();
const db = new AWS.DynamoDB.DocumentClient();
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);
const treezorClient = new TreezorClient(
  TREEZOR_BASE_URL,
  TREEZOR_CLIENT_ID,
  TREEZOR_CLIENT_SECRET,
  dynamoHelper,
  IMAGES_DOMAIN,
);

export const handler: Handler = async (event: FunctionEvent) => {
  const {
    arguments: { filter = {} },
    identity: { sub, claims },
    info: { fieldName },
    request: {
      headers: { authorization: token },
    },
  } = event;

  console.debug(JSON.stringify(event, null, 4));
  
  // TODO: check walletId in my token
  let { walletId } = filter;
  const { ['custom:trzWalletsId']: trzWalletsId } = claims;

  if (!walletId) {
    // if filter is empty, use my walletId
    walletId = trzWalletsId;
  }

  const items = await treezorClient.getTransactions(Number(walletId), token);

  return { items };
};
