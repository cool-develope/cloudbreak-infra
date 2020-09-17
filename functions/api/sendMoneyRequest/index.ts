// @ts-ignore
import * as AWS from 'aws-sdk';
import * as OneSignal from 'onesignal-node';
import { Handler } from 'aws-lambda';

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN,
  ES_DOMAIN,
  ONESIGNAL_APP_ID = '',
  ONESIGNAL_API_KEY = '',
} = process.env;

const db = new AWS.DynamoDB.DocumentClient();

const getDeviceIds = async (pk: string) => {
  const getResult = await getItem(pk, 'devices');
  if (getResult.Item) {
    return getResult.Item.ids.values;
  }

  return [];
};

const sendPushNotifications = (player_ids: string[] = [], data: any) => {
  const client = new OneSignal.Client(ONESIGNAL_APP_ID, ONESIGNAL_API_KEY);

  const notification = {
    headings: {
      en: 'Money Request',
    },
    contents: {
      en: `${data.firstName} ${data.lastName}, €${data.amount}`,
    },
    data,
    include_player_ids: player_ids,
  };

  return client.createNotification(notification);
};

const scanItems = (pk: string, sk: string, email: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    FilterExpression: 'begins_with(pk, :pk) and sk = :sk and email = :email',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': sk,
      ':email': email,
    },
  };

  return db.scan(params).promise();
};

const getItem = (pk: string, sk: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: { pk, sk },
  };

  return db.get(params).promise();
};

const getImageUrl = (photo: string = '') => (photo ? `https://${IMAGES_DOMAIN}/${photo}` : '');

const sendMoneyRequest = async (
  senderUser: any,
  receiverUser: any,
  email: string,
  amount: string,
  note: string,
): Promise<string[]> => {
  const errors: string[] = [];

  /**
   * TODO: check treezorWalletId/treezorUserId for sender and receiver
   * TODO: check receiver devices ids
   */

  if (!receiverUser) {
    errors.push('Recipient Not Found');
    return errors;
  }

  const ids = await getDeviceIds(receiverUser.pk);

  try {
    const data = {
      type: 'money-request',
      firstName: senderUser.firstName,
      lastName: senderUser.lastName,
      photo: getImageUrl(senderUser.photo),
      treezorUserId: senderUser.treezorUserId || null,
      treezorWalletId: senderUser.treezorWalletId || null,
      email,
      amount,
      note,
    };
    const res = await sendPushNotifications(ids, data);
    console.log('Push data', data);
    console.log('Push ids', ids);
    console.log('Push result', res);
  } catch (e) {
    errors.push('Error during sending push notification');
    console.log(e);
  }

  return errors;
};

export const handler: Handler = async (event): Promise<{ errors: string[] }> => {
  const {
    arguments: {
      input: { email, amount, note },
    },
    identity: { sub },
    info: { fieldName },
  } = event;

  const { Item: senderUser } = await getItem(`user#${sub}`, 'metadata');
  const { Items: receivers } = await scanItems('user#', 'metadata', email);
  const [receiverUser] = receivers;

  const errors = await sendMoneyRequest(senderUser, receiverUser, email, amount, note);
  return { errors };
};
