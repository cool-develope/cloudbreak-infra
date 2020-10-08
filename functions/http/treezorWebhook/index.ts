// @ts-ignore
import * as AWS from 'aws-sdk';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import * as OneSignal from 'onesignal-node';
// @ts-ignore
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import CognitoHelper from './cognitoHelper';
import DynamoHelper from './dynamoHelper';

enum WebhookEvent {
  card_options = 'card.options',
  card_setpin = 'card.setpin',
  card_unblockpin = 'card.unblockpin',
  card_lockunlock = 'card.lockunlock',
  card_requestphysical = 'card.requestphysical',
  card_createvirtual = 'card.createvirtual',
  card_convertvirtual = 'card.convertvirtual',
  card_changepin = 'card.changepin',
  card_activate = 'card.activate',
  card_renew = 'card.renew',
  card_regenerate = 'card.regenerate',
  card_update = 'card.update',
  card_limits = 'card.limits',
  payin_create = 'payin.create',
  payin_update = 'payin.update',
  payin_cancel = 'payin.cancel',
  payout_create = 'payout.create',
  payout_update = 'payout.update',
  payout_cancel = 'payout.cancel',
  payinrefund_create = 'payinrefund.create',
  payinrefund_update = 'payinrefund.update',
  payinrefund_cancel = 'payinrefund.cancel',
  transaction_create = 'transaction.create',
  cardtransaction_create = 'cardtransaction.create',
  transfer_create = 'transfer.create',
  transfer_update = 'transfer.update',
  transfer_cancel = 'transfer.cancel',
  transferrefund_create = 'transferrefund.create',
  transferrefund_update = 'transferrefund.update',
  transferrefund_cancel = 'transferrefund.cancel',
  user_create = 'user.create',
  user_update = 'user.update',
  user_cancel = 'user.cancel',
  user_kycreview = 'user.kycreview',
  user_kycrequest = 'user.kycrequest',
  wallet_create = 'wallet.create',
  wallet_update = 'wallet.update',
  wallet_cancel = 'wallet.cancel',
}

enum KycReview {
  NONE = '0',
  PENDING = '1',
  VALIDATED = '2',
  REFUSED = '3',
}

const KYC_REVIEW_NAMES = new Map<string, string>([
  ['0', 'NONE'],
  ['1', 'PENDING'],
  ['2', 'VALIDATED'],
  ['3', 'REFUSED'],
]);

interface Webhood {
  webhook: WebhookEvent;
  webhook_id: string;
  object: string;
  object_id: string;
  object_payload: any;
  object_payload_signature: string;
  auth_key: string;
}

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN,
  ONESIGNAL_APP_ID = '',
  ONESIGNAL_API_KEY = '',
  ES_DOMAIN,
  COGNITO_USERPOOL_ID = '',
  TREEZOR_BASE_URL,
  TREEZOR_CLIENT_ID = '',
  TREEZOR_CLIENT_SECRET = '',
} = process.env;

const db = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();
const eventbridge = new AWS.EventBridge();

const putEvents = (type: string, detail: any) => {
  const params = {
    Entries: [
      {
        Source: 'tifo.treezor',
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
    ReturnValues: 'ALL_NEW',
  };

  return db.update(params).promise();
};

const scanItems = (pk: string, sk: string, treezorUserId: number) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    FilterExpression: 'begins_with(pk, :pk) and sk = :sk and treezorUserId = :treezorUserId',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': sk,
      ':treezorUserId': treezorUserId,
    },
  };

  return db.scan(params).promise();
};

const getUser = async (treezorUserId: string): Promise<any> => {
  const treezorUserIdNumber = Number(treezorUserId);
  const { Items } = await scanItems('user#', 'metadata', treezorUserIdNumber);
  if (Items && Items.length) {
    return Items[0];
  } else {
    throw Error(`User not found: ${treezorUserId}`);
  }
};

const updateUserAttributes = ({
  userPoolId,
  sub,
  trzWalletsId,
}: {
  userPoolId: string;
  sub: string;
  trzWalletsId: string;
}) => {
  const params = {
    UserAttributes: [
      {
        Name: 'custom:trzWalletsId',
        Value: trzWalletsId,
      },
    ],
    UserPoolId: userPoolId,
    Username: sub,
  };

  return cognito.adminUpdateUserAttributes(params).promise();
};

const getTreezorToken = async (): Promise<string> => {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', TREEZOR_CLIENT_ID);
  params.append('client_secret', TREEZOR_CLIENT_SECRET);
  params.append('scope', 'read_only read_write admin keys legal');

  try {
    const res = await fetch(`${TREEZOR_BASE_URL}/oauth/token`, {
      method: 'POST',
      body: params,
    });

    const { access_token } = await res.json();
    return access_token;
  } catch (err) {
    console.error({
      params,
      err,
    });
    throw Error(`Error retrieving Treezor token`);
  }
};

const createTreezorWallet = async (
  treezorToken: string,
  { eventName, userId, tariffId, walletTypeId }: any,
) => {
  const params = new URLSearchParams();
  params.append('currency', 'EUR');
  params.append('walletTypeId', walletTypeId);
  params.append('tariffId', tariffId);
  params.append('userId', userId);
  params.append('eventName', eventName);

  const url = `${TREEZOR_BASE_URL}/v1/wallets?${params}`;
  console.log(url);

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${treezorToken}` },
  });

  return await response.json();
};

const createWallet = async (treezorUserId: string) => {
  const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);

  /**
   * 1. Get user info
   */
  const user = await getUser(treezorUserId);
  const tifoUserId: string = user.pk.replace('user#', '');

  /**
   * 2. Get Treezor token
   */
  const treezorToken = await getTreezorToken();

  /**
   * 3. Create wallet
   */
  const wallet = await createTreezorWallet(treezorToken, {
    walletTypeId: '9',
    tariffId: '113',
    userId: treezorUserId,
    eventName: 'Wallet',
  });

  const treezorWalletId = wallet.wallets[0].walletId;

  /**
   * 4. Update Cognito user
   */
  await updateUserAttributes({
    userPoolId: COGNITO_USERPOOL_ID,
    sub: tifoUserId,
    trzWalletsId: String(treezorWalletId),
  });

  /**
   * 5. Update user info
   */
  await updateItem(user.pk, 'metadata', { treezorWalletId, modifiedAt: new Date().toISOString() });

  console.log('WALLET CREATED', {
    treezorUserId,
    tifoUserId,
    treezorWalletId,
  });

  const parentTifoUserId = user.parentUserId;
  if (parentTifoUserId) {
    const cognitoHelper = new CognitoHelper(cognito, COGNITO_USERPOOL_ID, parentTifoUserId);
    await cognitoHelper.addChildrenData(Number(treezorUserId), [], [Number(treezorWalletId)]);
    console.log('ADDED CHILD TO TOKEN', {
      parentTifoUserId,
      tifoUserId,
      treezorUserId,
      treezorWalletId,
    });
  }
};

const updateKycReview = async ({
  userId: treezorUserId,
  kycReview,
}: {
  userId: string;
  kycReview: KycReview;
}) => {
  const kycReviewName = KYC_REVIEW_NAMES.get(kycReview);
  const user = await getUser(treezorUserId);
  const tifoUserId = user.pk.replace('user#', '');
  
  await updateItem(user.pk, 'metadata', {
    kycReview: kycReviewName,
    modifiedAt: new Date().toISOString(),
  });

  if (kycReview === KycReview.VALIDATED || kycReview === KycReview.REFUSED) {
    await putEvents('KycReview', {
      sub: tifoUserId,
      status: kycReviewName,
    });
  }
};

const processWebhook = async (h: Webhood) => {
  switch (h.webhook) {
    case WebhookEvent.user_create:
      await createWallet(h.object_payload.users[0].userId);
      break;
    case WebhookEvent.wallet_create:
      break;
    case WebhookEvent.user_kycrequest:
      await updateKycReview(h.object_payload.users[0]);
      break;
    case WebhookEvent.user_kycreview:
      await updateKycReview(h.object_payload.users[0]);
      break;
  }
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body = '' } = event;
  let statusCode = 200;

  /**
   * TODO: validate "object_payload_signature"
   */

  try {
    const h: Webhood = JSON.parse(body);
    console.log(JSON.stringify(h, null, 4));
    await processWebhook(h);
  } catch (err) {
    console.error(err);
    statusCode = 500;
  }

  return {
    statusCode,
  };
};
