// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import * as OneSignal from 'onesignal-node';
import { UpdateUserInput, User, Gender, Image, FieldName } from './types';

const db = new AWS.DynamoDB.DocumentClient();
const {
  MAIN_TABLE_NAME,
  IMAGES_DOMAIN,
  ONESIGNAL_APP_ID = '',
  ONESIGNAL_API_KEY = '',
} = process.env;

const getUpdateExpression = (attributes: any = {}) =>
  Object.keys(attributes)
    .map((key) => (attributes[key] !== undefined && attributes[key] !== null ? `${key} = :${key}` : null))
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

const getItem = (pk: string, sk: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: { pk, sk },
  };

  return db.get(params).promise();
};

const getDeviceIds = async (pk: string) => {
  const getResult = await getItem(pk, 'devices');
  if (getResult.Item) {
    return getResult.Item.ids.values;
  }

  return [];
};

const getTypeUser = ({
  pk,
  firstName,
  lastName,
  country,
  photo,
  phone,
  phoneCountry,
  birthDate,
  birthCountry,
  birthCity,
  gender,
  usCitizen,
}: UpdateUserInput = {}): User => ({
  firstName,
  lastName,
  country,
  photo: getTypeImage(photo),
  phone,
  phoneCountry,
  birthDate,
  birthCountry,
  birthCity,
  gender,
  usCitizen,
});

const getTypeImage = (photo: string = '') => ({
  url: photo ? `https://${IMAGES_DOMAIN}/${photo}` : '',
});

const sendPushNotifications = (player_ids?: [string]) => {
  const client = new OneSignal.Client(ONESIGNAL_APP_ID, ONESIGNAL_API_KEY);

  const notification = {
    contents: {
      en: 'Update user notification!',
    },
    include_player_ids: player_ids,
  };

  return client.createNotification(notification);
};

const updateUser = async (pk: string, input: any) => {
  const { Attributes } = await updateItem(pk, 'metadata', input);
  const user = getTypeUser(Attributes);
  return user;
};

export const handler: Handler = async (event) => {
  const {
    arguments: { input = {} },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;
  const pk = `user#${sub}`;

  if (field === FieldName.updateUser) {
    // const ids = await getDeviceIds(pk);
    // try {
    //   const res = await sendPushNotifications(ids);
    //   console.log(res);
    // } catch (e) {
    //   console.log(e);
    // }

    /**
     * Mutation updateUser:
     */
    const user = await updateUser(pk, input);

    return {
      errors: [],
      user,
    };
  } else if (field === FieldName.me) {
    /**
     * Query me:
     */
    const { Item } = await getItem(pk, 'metadata');
    const user = getTypeUser(Item);
    return user;
  }

  return null;
};
