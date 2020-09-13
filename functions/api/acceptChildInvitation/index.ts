// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

export enum FieldName {
  acceptChildInvitation = 'acceptChildInvitation',
  declineChildInvitation = 'declineChildInvitation',
}

const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN, ES_DOMAIN } = process.env;

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

const updateItemSetAdd = (pk: string, sk: string, item: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: { pk, sk },
    UpdateExpression: `ADD children :id`,
    ExpressionAttributeValues: {
      ':id': db.createSet([item]),
    },
  };

  return db.update(params).promise();
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

const getTimeDifferenceInHours = (createdAt: string) => {
  if (!createdAt) {
    createdAt = new Date(0).toISOString();
  }

  const dateBegin = new Date(createdAt);
  const dateEnd = Date.now();
  const difference = (dateEnd - dateBegin.getTime()) / 1000 / 60 / 60;
  return difference;
};

export const handler: Handler = async (event): Promise<{ errors: string[] }> => {
  const {
    arguments: {
      input: { invitationId },
    },
    identity: {
      sub,
      claims: { email },
    },
    info: { fieldName },
  } = event;

  /**
   * TODO: Move to EventBridge
   * TODO: Log wrong attemps
   * TODO: Block after 5 wrong attemps
   * TODO: Double check parentUserId
   * TODO: Log connecton, userId = parentUserId
   */

  const errors: string[] = [];
  const field = fieldName as FieldName;
  const pk = `invitation#${email}`;
  const sk = `child#${invitationId}`;

  const { Item: invitation } = await getItem(pk, sk);

  if (invitation && invitation.inviteStatus === 'pending') {
    const hoursFromCreation = getTimeDifferenceInHours(invitation.createdAt);
    const invitationExpired = hoursFromCreation > 24;

    if (invitationExpired) {
      errors.push('Invitation is expired');
    } else {
      if (field === FieldName.acceptChildInvitation) {
        const invitationData = {
          modifiedAt: new Date().toISOString(),
          inviteStatus: 'accepted',
        };

        const userData = {
          modifiedAt: new Date().toISOString(),
          parentUserId: sub,
        };

        // Update parent user (me)
        await updateItemSetAdd(`user#${sub}`, 'metadata', invitationId);

        // Update child user
        await updateItem(`user#${invitationId}`, 'metadata', userData);

        // Update invitation
        await updateItem(pk, sk, invitationData);
      } else if (field === FieldName.declineChildInvitation) {
        const data = {
          modifiedAt: new Date().toISOString(),
          inviteStatus: 'declined',
        };

        await updateItem(pk, sk, data);
      }
    }
  } else if (invitation && invitation.inviteStatus !== 'pending') {
    errors.push('Invitation alredy accepted/declined');
  } else {
    errors.push('Invitation not found');
  }

  return { errors };
};