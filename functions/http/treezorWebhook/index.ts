// @ts-ignore
import * as AWS from 'aws-sdk';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import * as OneSignal from 'onesignal-node';
// @ts-ignore
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import CognitoHelper from './cognitoHelper';
import DynamoHelper from './dynamoHelper';
import {
  Transfer,
  WebhookEvent,
  KycReview,
  Webhook,
  TransferType,
  Card,
  TransferBody,
  TransferTypeId,
} from './types';

const KYC_REVIEW_NAMES = new Map<string, string>([
  ['0', 'NONE'],
  ['1', 'PENDING'],
  ['2', 'VALIDATED'],
  ['3', 'REFUSED'],
]);

enum EventSource {
  TifoTreezor = 'tifo.treezor',
  TifoApi = 'tifo.api',
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
  TREEZOR_TIFO_WALLET_ID = '',
} = process.env;

const db = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();
const eventbridge = new AWS.EventBridge();
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);

const putEvents = (source: EventSource, type: string, detail: any) => {
  const params = {
    Entries: [
      {
        Source: source,
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

const scanItems = (pk: string, sk: string, fieldName: string, fieldValue: any) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    FilterExpression: `begins_with(pk, :pk) and sk = :sk and ${fieldName} = :fieldValue`,
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': sk,
      ':fieldValue': fieldValue,
    },
  };

  return db.scan(params).promise();
};

const getUserByTreezorUserId = async (treezorUserId: string): Promise<any> => {
  const { Items } = await scanItems('user#', 'metadata', 'treezorUserId', Number(treezorUserId));
  return Items?.[0];
};

const getUserByTreezorWalletId = async (treezorWalletId: string): Promise<any> => {
  const { Items } = await scanItems(
    'user#',
    'metadata',
    'treezorWalletId',
    Number(treezorWalletId),
  );
  return Items?.[0];
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
  params.append('scope', 'read_only read_write admin keys legal read_all');

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

const createTransfer = async (treezorToken: string, transferData: TransferBody) => {
  const url = `${TREEZOR_BASE_URL}/v1/transfers`;

  console.debug('createTransfer', {
    url,
    transferData,
  });

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(transferData),
    headers: { Authorization: `Bearer ${treezorToken}`, 'Content-Type': 'application/json' },
  });

  const json = await response.json();
  console.debug(json);

  return json;
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
  /**
   * 1. Get user info
   */
  const user = await getUserByTreezorUserId(treezorUserId);
  const tifoUserId: string = user.pk.replace('user#', '');
  const fullName = `${user.firstName} ${user.lastName}`;

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
    eventName: fullName,
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
  const user = await getUserByTreezorUserId(treezorUserId);
  const tifoUserId = user.pk.replace('user#', '');

  await updateItem(user.pk, 'metadata', {
    kycReview: kycReviewName,
    modifiedAt: new Date().toISOString(),
  });

  if (kycReview === KycReview.VALIDATED || kycReview === KycReview.REFUSED) {
    await putEvents(EventSource.TifoTreezor, 'KycReview', {
      sub: tifoUserId,
      status: kycReviewName,
    });
  }
};

const getDetailsByTransferTag = (
  transferTag: string,
): { type: TransferType; id: string } | null => {
  if (transferTag.startsWith('event:')) {
    return {
      type: TransferType.Event,
      id: transferTag.replace('event:', ''),
    };
  }

  return null;
};

const takeFee = async (walletId: string, amount: string, eventId: string, transferId: string) => {
  try {
    //TODO: log transfer if fee not taken

    const treezorToken = await getTreezorToken();

    const amountNumber = Number(amount);
    const feeAmount = Number((amountNumber / 100).toFixed(2));

    console.debug('TRANSFER_FEE', {
      walletId,
      amount,
      feeAmount,
      eventId,
      transferId,
    });

    const transferData: TransferBody = {
      walletId: Number(walletId),
      beneficiaryWalletId: Number(TREEZOR_TIFO_WALLET_ID),
      transferTag: `fee:${transferId}`,
      label: 'Fee',
      amount: feeAmount,
      currency: 'EUR',
      transferTypeId: TransferTypeId.ClientFees,
    };

    await createTransfer(treezorToken, transferData);
  } catch (err) {
    console.error(err);
  }
};

const processTransferUpdate = async (transfer: Transfer) => {
  if (transfer.transferStatus === 'VALIDATED') {
    const { walletId, transferTag, amount, beneficiaryWalletId, transferId } = transfer;
    const user = await getUserByTreezorWalletId(walletId);

    if (!user) {
      throw Error(`processTransferUpdate, user not found by walletId: ${walletId}`);
    }

    const transferDetails = getDetailsByTransferTag(transferTag);

    if (transferDetails && transferDetails.type === TransferType.Event) {
      // TODO: validate beneficiaryWalletId
      // TODO: validate amount

      const eventId = transferDetails.id;
      const userId = user.pk.replace('user#', '');
      const pk = `event#${eventId}`;
      const sk = `user#${userId}`;

      console.log('Paid event:', { eventId, userId, amount, transferId });

      await dynamoHelper.updateItem(pk, sk, { a: true, treezorTransferId: transferId });
      await dynamoHelper.incrementField(pk, 'metadata', 'acceptedCount');

      await putEvents(EventSource.TifoApi, 'AcceptedPaidEvent', {
        sub: userId,
        eventId,
        amount,
      });

      await takeFee(beneficiaryWalletId, amount, eventId, transferId);
    }
  }
};

const processCreateVirtualCard = async (card: Card) => {
  /**
   * Card of adult/parent
   * Card of child
   */

  const { userId, walletId, cardId } = card;
  const user = await getUserByTreezorUserId(userId);

  if (!user) {
    throw Error(`processCreateVirtualCard, user not found by userId: ${userId}`);
  }

  const tifoUserId = user.pk.replace('user#', '');
  const cognitoHelper = new CognitoHelper(cognito, COGNITO_USERPOOL_ID, tifoUserId);
  await cognitoHelper.addCard(cardId);

  const { parentUserId } = user;
  if (parentUserId) {
    const parentCognito = new CognitoHelper(cognito, COGNITO_USERPOOL_ID, parentUserId);
    await parentCognito.addChildrenData(Number(userId), [Number(cardId)], []);
    console.log('Add child card to parent', {
      childId: parentUserId,
      parentId: tifoUserId,
      userId,
      cardId,
    });
  }

  console.log('card_createvirtual', {
    tifoUserId,
    userId,
    walletId,
    cardId,
  });
};

const processWebhook = async (h: Webhook) => {
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
    case WebhookEvent.transfer_update:
      await processTransferUpdate(h.object_payload.transfers[0]);
    case WebhookEvent.card_createvirtual:
      await processCreateVirtualCard(h.object_payload.cards[0]);
  }
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body = '' } = event;
  let statusCode = 200;

  /**
   * TODO: validate "object_payload_signature"
   */

  try {
    const h: Webhook = JSON.parse(body);
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
