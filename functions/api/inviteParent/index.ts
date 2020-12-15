// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN, ES_DOMAIN, INVITATION_URL = '' } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const eventbridge = new AWS.EventBridge();

const putEvents = (type: string, detail: any) => {
  const params = {
    Entries: [
      {
        Source: 'tifo.api',
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

const formatDate = (str: string) => {
  const d = new Date(str || Date.now());
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export const handler: Handler = async (event): Promise<{ errors: string[] }> => {
  const {
    arguments: {
      input: { email },
    },
    identity: { sub },
    info: { fieldName },
  } = event;

  const errors: string[] = [];
  const pk = `invitation#${email}`;
  const sk = `child#${sub}`;

  /**
   * TODO: Move to EventBridge
   * TODO: Validate email
   */

  /**
   * Reject if I have a parentUserId
   */
  const { Item: user } = await getItem(`user#${sub}`, 'metadata');
  if (user.parentUserId) {
    return {
      errors: ['You already have a perent'],
    };
  }

  /**
   * Reject if invitation exists and pending
   */
  const { Item: invitation } = await getItem(pk, sk);
  if (invitation?.inviteStatus === 'pending') {
    return {
      errors: ['Your invitation already exists and waiting for approval'],
    };
  }

  const invitationData = {
    createdAt: new Date().toISOString(),
    modifiedAt: '',
    inviteStatus: 'pending',
  };

  await updateItem(pk, sk, invitationData);
  const { Items: parents } = await scanItems('user#', 'metadata', email);
  const [parentUser] = parents;
  const parentSub = parentUser ? parentUser.pk.replace('user#', '') : null;

  const invitationUrl = INVITATION_URL;
  const photo = user.photo
    ? `https://${IMAGES_DOMAIN}/${user.photo}`
    : `https://${IMAGES_DOMAIN}/email/nophoto.png`;
  const birthDate = formatDate(user.birthDate);
  const childEmail = user.email;

  await putEvents('InviteParent', {
    invitationUrl,
    childSub: sub,
    childEmail,
    childFirstName: user.firstName,
    childLastName: user.lastName,
    childPhoto: photo,
    childBirthDate: birthDate,
    childParentSub: parentSub,
    parentEmail: email,
  });

  return { errors };
};
