// @ts-ignore
import * as AWS from 'aws-sdk';
import { EventBridgeHandler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { Client } from '@elastic/elasticsearch';
import { NotificationType, KeyValue } from './common-code/nodejs/types/notifications';
import { NotificationsModel } from './common-code/nodejs/models';
import DynamoHelper from './common-code/nodejs/dynamoHelper';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN = '', ES_DOMAIN } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);

const objToKeyValueArray = (obj: any): KeyValue[] =>
  Object.keys(obj).map((key) => ({
    Key: key,
    Value: obj[key],
  }));

const getParentUser = async (sub: string) => {
  try {
    const { Item: child } = await dynamoHelper.getItem(`user#${sub}`, 'metadata');
    if (child && child.parentUserId) {
      const { Item: parent } = await dynamoHelper.getItem(`user#${child.parentUserId}`, 'metadata');
      if (parent) {
        return {
          sub: child.parentUserId,
        };
      }
    }
  } catch (err) {
    console.error(err, {
      sub,
    });
  }

  return null;
};

export const handler: EventBridgeHandler<any, any, any> = async (event) => {
  const { detail } = event;
  const type = event['detail-type'];

  const notificationsModel = new NotificationsModel(db, MAIN_TABLE_NAME, IMAGES_DOMAIN, uuidv4, es);
  console.log(type, detail);

  switch (type) {
    case NotificationType.SendTeamInvitation:
      await notificationsModel.create(detail.sub, {
        type,
        attributes: objToKeyValueArray({
          teamId: detail.teamId,
          teamName: detail.teamName,
          role: detail.role,
        }),
      });
      break;

    case NotificationType.DeclineTeamInvitation:
      await notificationsModel.create(detail.sub, {
        type,
        attributes: objToKeyValueArray({
          teamId: detail.teamId,
          teamName: detail.teamName,
          role: detail.role,
        }),
      });
      break;

    case NotificationType.AcceptTeamInvitation:
      await notificationsModel.create(detail.sub, {
        type,
        attributes: objToKeyValueArray({
          teamId: detail.teamId,
          teamName: detail.teamName,
          role: detail.role,
        }),
      });
      break;

    case NotificationType.SendMoneyRequest:
      const parent = await getParentUser(detail.senderSub);
      if (parent) {
        /**
         * Add notification for parent
         */
        await notificationsModel.create(parent.sub, {
          type: NotificationType.ChildSendMoneyRequest,
          attributes: objToKeyValueArray({
            childFirstName: detail.senderFirstName,
            childLastName: detail.senderLastName,
            recipientFirstName: detail.recipientFirstName,
            recipientLastName: detail.recipientLastName,
            amount: detail.amount,
            note: detail.note,
          }),
        });
      }

      await notificationsModel.create(detail.recipientSub, {
        type,
        attributes: objToKeyValueArray({
          senderUserId: detail.senderSub,
          senderEmail: detail.senderEmail,
          senderFirstName: detail.senderFirstName,
          senderLastName: detail.senderLastName,
          senderPhoto: detail.senderPhoto,
          amount: detail.amount,
          note: detail.note,
        }),
      });
      break;

    case NotificationType.AcceptChildInvitation:
      await notificationsModel.create(detail.childSub, {
        type,
        attributes: objToKeyValueArray({
          parentUserId: detail.parentSub,
          parentFirstName: detail.parentFirstName,
          parentLastName: detail.parentLastName,
        }),
      });
      break;

    case NotificationType.DeclineChildInvitation:
      await notificationsModel.create(detail.childSub, {
        type,
        attributes: objToKeyValueArray({
          parentUserId: detail.parentSub,
          parentFirstName: detail.parentFirstName,
          parentLastName: detail.parentLastName,
        }),
      });
      break;

    case NotificationType.KycReview:
      await notificationsModel.create(detail.sub, {
        type,
        attributes: objToKeyValueArray({
          status: detail.status,
        }),
      });
      break;

    case NotificationType.InviteParent:
      await notificationsModel.create(detail.childParentSub, {
        type,
        attributes: objToKeyValueArray({
          childUserId: detail.childSub,
          childEmail: detail.childEmail,
          childFirstName: detail.childFirstName,
          childLastName: detail.childLastName,
          childBirthDate: detail.childBirthDate,
          childPhoto: detail.childPhoto,
        }),
      });
      break;
  }
};
