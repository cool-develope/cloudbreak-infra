// @ts-ignore
import * as AWS from 'aws-sdk';
import { EventBridgeHandler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { Client } from '@elastic/elasticsearch';
import {
  NotificationType,
  KeyValue,
  NotificationTeamInvitation,
  NotificationKycReview,
  NotificationInviteParent,
  NotificationChildInvitation,
  NotificationSendMoneyRequest,
  EmailType,
} from './common-code/nodejs/types/notifications';
import { NotificationsModel } from './common-code/nodejs/models';
import DynamoHelper from './common-code/nodejs/dynamoHelper';
import PushNotifications from './pushNotifications';
import MailService from './mailService';

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN = '',
  ES_DOMAIN,
  SES_FROM_ADDRESS = '',
  SES_REGION,
} = process.env;

const db = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES({ region: SES_REGION });
const es = new Client({ node: ES_DOMAIN });
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);
const notificationsModel = new NotificationsModel(db, MAIN_TABLE_NAME, IMAGES_DOMAIN, uuidv4, es);
const pushNotifications = new PushNotifications(IMAGES_DOMAIN);
const mailService = new MailService(ses, SES_FROM_ADDRESS, IMAGES_DOMAIN);

const getDeviceIds = async (userId: string) => {
  const res = await dynamoHelper.getItem(`user#${userId}`, 'devices');
  return res?.Item?.ids?.values || [];
};

const getImageUrl = (image: string = '') => (image ? `https://${IMAGES_DOMAIN}/${image}` : '');

const getUserLanguage = async (userId: string) => {
  const { Item: userData } = await dynamoHelper.getItem(`user#${userId}`, 'metadata');
  return userData?.language || 'en';
};

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

const acceptedPaidEventHandler = async (type: NotificationType, detail: any) => {
  const { sub, eventId, amount } = detail;
  const { Item: child } = await dynamoHelper.getItem(`user#${sub}`, 'metadata');
  const { Item: event } = await dynamoHelper.getItem(`event#${eventId}`, 'metadata');
  const parent = await getParentUser(sub);

  if (parent && child && event) {
    /**
     * Add notification for parent
     */
    await notificationsModel.create(parent.sub, {
      type: NotificationType.ChildAcceptedPaidEvent,
      attributes: objToKeyValueArray({
        childFirstName: child.firstName,
        childLastName: child.lastName,
        eventName: event.title,
        price: event.price,
      }),
    });
  }
};

const sendTeamInvitation = async (type: NotificationType, detail: NotificationTeamInvitation) => {
  const deviceIds = await getDeviceIds(detail.sub);
  const language = await getUserLanguage(detail.sub);
  await pushNotifications.send(language, deviceIds, type, detail);
  await notificationsModel.create(detail.sub, {
    type,
    attributes: objToKeyValueArray({
      teamId: detail.teamId,
      teamName: detail.teamName,
      role: detail.role,
    }),
  });
};

const sendKycReview = async (type: NotificationType, detail: NotificationKycReview) => {
  const sub = detail.sub;
  const deviceIds = await getDeviceIds(sub);
  const language = await getUserLanguage(sub);
  await pushNotifications.send(language, deviceIds, type, detail);
  await notificationsModel.create(detail.sub, {
    type,
    attributes: objToKeyValueArray({
      status: detail.status,
    }),
  });
};

const sendInviteParent = async (type: NotificationType, detail: NotificationInviteParent) => {
  const sub = detail.childParentSub;
  const deviceIds = await getDeviceIds(sub);
  const language = await getUserLanguage(sub);
  await pushNotifications.send(language, deviceIds, type, detail);
  await mailService.send(detail.parentEmail, EmailType.InviteParent, detail, language);
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
};

const sendChildInvitation = async (type: NotificationType, detail: NotificationChildInvitation) => {
  const sub = detail.childSub;
  const deviceIds = await getDeviceIds(sub);
  const language = await getUserLanguage(sub);
  await pushNotifications.send(language, deviceIds, type, detail);
  await notificationsModel.create(detail.childSub, {
    type,
    attributes: objToKeyValueArray({
      parentUserId: detail.parentSub,
      parentFirstName: detail.parentFirstName,
      parentLastName: detail.parentLastName,
    }),
  });
};

const sendSendMoneyRequest = async (
  type: NotificationType,
  detail: NotificationSendMoneyRequest,
) => {
  const sub = detail.recipientSub;
  const deviceIds = await getDeviceIds(sub);
  const language = await getUserLanguage(sub);
  await pushNotifications.send(language, deviceIds, type, detail);

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
};

export const handler: EventBridgeHandler<any, any, any> = async (event) => {
  const { detail } = event;
  const type: NotificationType = event['detail-type'];
  console.log(type, detail);

  switch (type) {
    case NotificationType.SendTeamInvitation:
      await sendTeamInvitation(type, detail);
      break;

    case NotificationType.DeclineTeamInvitation:
      await sendTeamInvitation(type, detail);
      break;

    case NotificationType.AcceptTeamInvitation:
      await sendTeamInvitation(type, detail);
      break;

    case NotificationType.SendMoneyRequest:
      await sendSendMoneyRequest(type, detail);
      break;

    case NotificationType.AcceptChildInvitation:
    case NotificationType.DeclineChildInvitation:
      await sendChildInvitation(type, detail);
      break;

    case NotificationType.KycReview:
      await sendKycReview(type, detail);
      break;

    case NotificationType.InviteParent:
      await sendInviteParent(type, detail);
      break;

    case NotificationType.AcceptedPaidEvent:
      await acceptedPaidEventHandler(type, detail);
      break;

    default:
      console.warn(`Unhandled notification: ${type}`);
      break;
  }
};
