// @ts-ignore
import * as AWS from 'aws-sdk';
import { EventBridgeHandler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { Client } from '@elastic/elasticsearch';
import { NotificationType, KeyValue } from './common-code/nodejs/types/notifications';
import { NotificationsModel } from './common-code/nodejs/models';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN = '', ES_DOMAIN } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });

const objToKeyValueArray = (obj: any): KeyValue[] =>
  Object.keys(obj).map((key) => ({
    Key: key,
    Value: obj[key],
  }));

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
  }
};
