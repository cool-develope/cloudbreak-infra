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
  cloudbreakTreezor = 'cloudbreak.treezor',
  cloudbreakApi = 'cloudbreak.api',
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
  TREEZOR_cloudbreak_WALLET_ID = '',
} = process.env;

const db = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();
const eventbridge = new AWS.EventBridge();
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);
const QR_PAYMENT_TAG_PATTERN = /^qr-payment:(?<id>[a-z0-9-]{36}),club:(?<club>[a-z0-9-]{36})+$/;

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

  if (!user) {
    throw Error(`Can't find user: ${treezorUserId}`);
  }

  const cloudbreakUserId: string = user.pk.replace('user#', '');
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
    sub: cloudbreakUserId,
    trzWalletsId: String(treezorWalletId),
  });

  /**
   * 5. Update user info
   */
  await updateItem(user.pk, 'metadata', { treezorWalletId, modifiedAt: new Date().toISOString() });

  console.log('WALLET CREATED', {
    treezorUserId,
    cloudbreakUserId,
    treezorWalletId,
  });

  const parentcloudbreakUserId = user.parentUserId;
  if (parentcloudbreakUserId) {
    const cognitoHelper = new CognitoHelper(cognito, COGNITO_USERPOOL_ID, parentcloudbreakUserId);
    await cognitoHelper.addChildrenData(Number(treezorUserId), [], [Number(treezorWalletId)]);
    console.log('ADDED CHILD TO TOKEN', {
      parentcloudbreakUserId,
      cloudbreakUserId,
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
  const cloudbreakUserId = user.pk.replace('user#', '');

  await updateItem(user.pk, 'metadata', {
    kycReview: kycReviewName,
    modifiedAt: new Date().toISOString(),
  });

  if (kycReview === KycReview.VALIDATED || kycReview === KycReview.REFUSED) {
    await putEvents(EventSource.cloudbreakTreezor, 'KycReview', {
      sub: cloudbreakUserId,
      status: kycReviewName,
    });
  }
};

const getDetailsByTransferTag = (
  transferTag: string,
): { type: TransferType; id?: string; club?: string } | null => {
  if (transferTag.startsWith('event:')) {
    return {
      type: TransferType.Event,
      id: transferTag.replace('event:', ''),
    };
  } else if (transferTag.startsWith('qr-payment:')) {
    const match = QR_PAYMENT_TAG_PATTERN.exec(transferTag);
    return {
      type: TransferType.QrPayment,
      id: match?.groups?.id,
      club: match?.groups?.club,
    };
  }

  return null;
};

const getFeeDetails = async (transferId: string, walletId: string): Promise<boolean> => {
  const { Item } = await dynamoHelper.getItem(`fee#${transferId}`, walletId);
  return Item && Item.pk ? true : false;
};

const takeFee = async (walletId: string, amount: string, item: string, transferId: string) => {
  try {
    //TODO: log transfer if fee not taken due to exception

    const feeExists = await getFeeDetails(transferId, walletId);
    if (feeExists) {
      return;
    }

    const treezorToken = await getTreezorToken();

    const amountNumber = Number(amount);
    const feeAmount = Number((amountNumber / 100).toFixed(2));

    console.debug('TRANSFER_FEE', {
      walletId,
      amount,
      feeAmount,
      item,
      transferId,
    });

    const transferData: TransferBody = {
      walletId: Number(walletId),
      beneficiaryWalletId: Number(TREEZOR_cloudbreak_WALLET_ID),
      transferTag: `fee:${transferId}`,
      label: 'Fee',
      amount: feeAmount,
      currency: 'EUR',
      transferTypeId: TransferTypeId.ClientFees,
    };

    await createTransfer(treezorToken, transferData);
    await dynamoHelper.updateItem(`fee#${transferId}`, walletId, {
      item,
      amount: Number(amount),
      fee: feeAmount,
      createdAt: new Date().toISOString(),
    });
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

    const userId = user.pk.replace('user#', '');
    const transferDetails = getDetailsByTransferTag(transferTag);

    console.log({
      action: 'Paid',
      type: transferDetails?.type,
      id: transferDetails?.id,
      userId,
      amount,
      transferId,
    });

    if (transferDetails && transferDetails.type === TransferType.Event) {
      // TODO: validate beneficiaryWalletId
      // TODO: validate amount

      const eventId = transferDetails.id;
      const feeItem = `event#${eventId}`;
      const pk = `event#${eventId}`;
      const sk = `user#${userId}`;

      await dynamoHelper.updateItem(pk, sk, {
        a: true,
        treezorTransferId: transferId,
        acceptedAt: new Date().toISOString(),
      });
      await dynamoHelper.incrementField(pk, 'metadata', 'acceptedCount');

      await putEvents(EventSource.cloudbreakApi, 'AcceptedPaidEvent', {
        sub: userId,
        eventId,
        amount,
      });

      await takeFee(beneficiaryWalletId, amount, feeItem, transferId);
    } else if (transferDetails && transferDetails.type === TransferType.QrPayment) {
      const qrPaymentId = transferDetails.id;
      const feeItem = `qr-payment#${qrPaymentId}`;
      const pk = `qr-payment#${qrPaymentId}`;
      const sk = `user#${userId}`;

      await dynamoHelper.updateItem(pk, sk, {
        clubId: transferDetails.club,
        treezorTransferId: transferId,
        createdAt: new Date().toISOString(),
      });

      await putEvents(EventSource.cloudbreakApi, 'PaidQrPayment', {
        sub: userId,
        qrPaymentId,
        amount,
        clubId: transferDetails.club,
      });

      await takeFee(beneficiaryWalletId, amount, feeItem, transferId);
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

  const cloudbreakUserId = user.pk.replace('user#', '');
  const cognitoHelper = new CognitoHelper(cognito, COGNITO_USERPOOL_ID, cloudbreakUserId);
  await cognitoHelper.addCard(cardId);

  const { parentUserId } = user;
  if (parentUserId) {
    const parentCognito = new CognitoHelper(cognito, COGNITO_USERPOOL_ID, parentUserId);
    await parentCognito.addChildrenData(Number(userId), [Number(cardId)], []);
    console.log('Add child card to parent', {
      childId: parentUserId,
      parentId: cloudbreakUserId,
      userId,
      cardId,
    });
  }

  console.log('card_createvirtual', {
    cloudbreakUserId,
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
      break;
    case WebhookEvent.card_createvirtual:
      const card = h.object_payload.cards[0];
      if (!card) {
        console.error('Empty body.', JSON.stringify(h.object_payload));
      }
      await processCreateVirtualCard(card);
      break;
    default:
      await putEvents(EventSource.cloudbreakTreezor, h.webhook, h.object_payload);
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
