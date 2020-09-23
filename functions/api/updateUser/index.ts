// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import * as OneSignal from 'onesignal-node';
import {
  UpdateUserInput,
  User,
  Gender,
  Image,
  FieldName,
  UserChild,
  ChildInvitation,
  OrganizationType,
  KycReview,
  OrganizationRole,
} from './types';

const db = new AWS.DynamoDB.DocumentClient();
const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN,
  ONESIGNAL_APP_ID = '',
  ONESIGNAL_API_KEY = '',
} = process.env;

const getUniqItemsFromArray = (arr: { pk: string; sk: string }[]) => {
  // TODO
  return arr;
};

const batchGet = async (
  arrayOfKeys: { pk: string; sk: string }[],
  idField: string,
  getType: (data: any) => any,
): Promise<Map<string, any>> => {
  const keys = getUniqItemsFromArray(arrayOfKeys);

  /**
   * Split items by batch max size (25)
   */
  const batchLimit = 25;
  const batchParams = [];
  while (keys.length) {
    const portionOfPutRequests = keys.splice(0, batchLimit);
    batchParams.push({
      RequestItems: {
        [MAIN_TABLE_NAME]: {
          Keys: portionOfPutRequests,
        },
      },
    });
  }

  /**
   * Run all batchWrite in parallel by portions
   */
  const arrayOfGet = batchParams.map((params) => db.batchGet(params).promise());
  const res = await Promise.all(arrayOfGet);

  const result = new Map();

  const arrayOfItems = res.map((resItem) => resItem.Responses[MAIN_TABLE_NAME]);
  for (const items of arrayOfItems) {
    for (const item of items) {
      result.set(item[idField], getType(item));
    }
  }

  return result;
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

const queryItems = (pk: string, sk: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    KeyConditionExpression: 'pk = :pk and begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': sk,
    },
  };

  return db.query(params).promise();
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

const getChildren = async ({ children }: { children: any }): Promise<UserChild[]> => {
  const childrenIds = (children && children.values) || [];
  const childrenData: UserChild[] = [];

  if (childrenIds && childrenIds.length) {
    const userKeys = childrenIds.map((userId: string) => ({
      pk: `user#${userId}`,
      sk: 'metadata',
    }));

    const users = await batchGet(userKeys, 'pk', getTypeUserChild);

    for (const userId of childrenIds) {
      childrenData.push(users.get(`user#${userId}`));
    }
  }

  return childrenData;
};

const getParent = async ({ parentUserId }: any): Promise<UserChild | null> => {
  if (parentUserId) {
    const { Item } = await getItem(`user#${parentUserId}`, 'metadata');
    return getTypeUserChild(Item);
  }

  return null;
};

const getPendingChildInvitations = async ({ email }: any): Promise<ChildInvitation[]> => {
  const pk = `invitation#${email}`;
  const { Items: invitations } = await queryItems(pk, 'child#');
  const pendingInvitations = invitations.filter((invite: any) => invite.inviteStatus === 'pending');

  if (pendingInvitations.length) {
    const userKeys = pendingInvitations.map(({ sk }: any) => ({
      pk: `user#${sk.replace('child#', '')}`,
      sk: 'metadata',
    }));
    const users = await batchGet(userKeys, 'pk', getTypeUserChild);

    return pendingInvitations.map((invite: any) => {
      const userId = invite.sk.replace('child#', '');
      const childInvitation: ChildInvitation = {
        invitationId: userId,
        createDate: invite.createdAt,
        user: users.get(`user#${userId}`),
      };

      return childInvitation;
    });
  }

  return [];
};

const getTypeUser = async (userData: any): Promise<User> => {
  const {
    pk,
    email = '',
    firstName = '',
    lastName = '',
    country,
    photo,
    phone,
    phoneCountry,
    birthDate,
    birthCountry,
    birthCity,
    gender,
    usCitizen,
    city,
    postcode,
    address1,
    address2,
    companyId,
    kycReview = KycReview.NONE,
  } = userData;

  // @ts-ignore
  const result = await Promise.allSettled([
    getChildren(userData),
    getParent(userData),
    getPendingChildInvitations(userData),
  ]);

  const [{ value: children }, { value: parent }, { value: pendingChildInvitations }] = result;
  const role: OrganizationRole = companyId ? OrganizationRole.Owner : OrganizationRole.Coach;

  return {
    email,
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
    city,
    postcode,
    address1,
    address2,
    children,
    parent,
    pendingChildInvitations,
    organization: {
      type: OrganizationType.Club,
      role,
    },
    kycReview,
  };
};

const getTypeUserChild = ({ firstName = '', lastName = '', photo = '' }: any) => ({
  firstName,
  lastName,
  photo: getTypeImage(photo),
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

const updateUser = async (pk: string, input: UpdateUserInput) => {
  const { Attributes: userData } = await updateItem(pk, 'metadata', input);
  const user = await getTypeUser(userData);
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
    input.modifiedAt = new Date().toISOString();
    const user = await updateUser(pk, input);

    return {
      errors: [],
      user,
    };
  } else if (field === FieldName.me) {
    /**
     * Query me:
     */
    const { Item: userData } = await getItem(pk, 'metadata');
    const user = await getTypeUser(userData);
    return user;
  }

  return null;
};
