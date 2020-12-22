// @ts-ignore
import * as AWS from 'aws-sdk';
import { EventBridgeHandler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { Client } from '@elastic/elasticsearch';
import {
  WebhookEvent,
  NotificationType,
  KeyValue,
  NotificationTeamInvitation,
  NotificationKycReview,
  NotificationInviteParent,
  NotificationChildInvitation,
  NotificationSendMoneyRequest,
  NotificationRejectMoneyRequest,
  EmailType,
  Transfer,
  TransferType,
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
  if (userId) {
    const res = await dynamoHelper.getItem(`user#${userId}`, 'devices');
    return res?.Item?.ids?.values || [];
  }

  return [];
};

const getImageUrl = (image: string = '') => (image ? `https://${IMAGES_DOMAIN}/${image}` : '');

const getUserLanguage = async (userId: string) => {
  if (userId) {
    const { Item: userData } = await dynamoHelper.getItem(`user#${userId}`, 'metadata');
    return userData?.language || 'en';
  }

  return 'en';
};

const getUserLanguageFromUserData = (userData: any) => userData?.language || 'en';

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

const getUserByTreezorUserId = async (treezorUserId: string): Promise<any | null> => {
  const { Items } = await scanItems('user#', 'metadata', 'treezorUserId', Number(treezorUserId));
  return Items?.[0];
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

const getUser = async (userId?: string | null) => {
  if (userId) {
    const { Item } = await dynamoHelper.getItem(`user#${userId}`, 'metadata');
    return Item;
  }

  return null;
};

const acceptedPaidEventHandler = async (type: NotificationType, detail: any) => {
  // TODO: Call in parallel
  const { sub, eventId, amount } = detail;
  const { Item: child } = await dynamoHelper.getItem(`user#${sub}`, 'metadata');
  const { Item: event } = await dynamoHelper.getItem(`event#${eventId}`, 'metadata');
  const parent = await getParentUser(sub);

  if (parent && child && event) {
    /**
     * Notification for parent
     */

    detail.eventPrice = event.price;
    detail.eventTitle = event.title;
    detail.childFirstName = child.firstName;

    const deviceIds = await getDeviceIds(parent.sub);
    const language = await getUserLanguage(parent.sub);

    await pushNotifications.send(language, deviceIds, type, detail);

    await notificationsModel.create(parent.sub, {
      type: NotificationType.ChildAcceptedPaidEvent,
      attributes: objToKeyValueArray({
        childFirstName: child.firstName,
        childLastName: child.lastName,
        childPhoto: getImageUrl(child.photo),
        eventName: event.title,
        eventImage: getImageUrl(event.image),
        eventId,
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
      clubId: detail.clubId,
      teamId: detail.teamId,
      teamName: detail.teamName,
      teamLogo: getImageUrl(detail.teamLogo),
      role: detail.role,
    }),
  });
};

const childSendTeamInvitation = async (
  type: NotificationType,
  detail: NotificationTeamInvitation,
) => {
  const parentSub = detail.parentSub || '';
  const [deviceIds, language] = await Promise.all([
    getDeviceIds(parentSub),
    getUserLanguage(parentSub),
  ]);

  await pushNotifications.send(language, deviceIds, type, detail);
  await notificationsModel.create(parentSub, {
    type,
    attributes: objToKeyValueArray({
      childUserId: detail.sub,
      childFirstName: detail.childFirstName,
      childLastName: detail.childLastName,
      childPhoto: detail.childPhoto,
      clubId: detail.clubId,
      teamId: detail.teamId,
      teamName: detail.teamName,
      teamLogo: getImageUrl(detail.teamLogo),
      role: detail.role,
    }),
  });
};

const sendTeamInvitationByParent = async (
  type: NotificationType,
  detail: NotificationTeamInvitation,
) => {
  const parentSub = detail.parentSub || '';
  const childSub = detail.sub || '';
  const [parentUser, childUser, childDeviceIds, childLanguage] = await Promise.all([
    getUser(parentSub),
    getUser(childSub),
    getDeviceIds(childSub),
    getUserLanguage(childSub),
  ]);

  detail.parentFirstName = parentUser.firstName;
  detail.parentLastName = parentUser.lastName;
  detail.childFirstName = childUser.firstName;
  detail.childLastName = childUser.lastName;

  await pushNotifications.send(childLanguage, childDeviceIds, type, detail);

  await notificationsModel.delete(
    parentSub,
    NotificationType.ChildSendTeamInvitation,
    objToKeyValueArray({
      childUserId: childSub,
      clubId: detail.clubId,
      teamId: detail.teamId,
    }),
  );

  // Child Notification
  await notificationsModel.create(childSub, {
    type,
    attributes: objToKeyValueArray({
      parentUserId: detail.parentSub,
      parentFirstName: detail.parentFirstName,
      parentLastName: detail.parentLastName,
      clubId: detail.clubId,
      teamId: detail.teamId,
      teamName: detail.teamName,
      teamLogo: getImageUrl(detail.teamLogo),
      role: detail.role,
    }),
  });

  // Parent Notification
  await notificationsModel.create(parentSub, {
    type,
    attributes: objToKeyValueArray({
      childUserId: detail.sub,
      childFirstName: detail.childFirstName,
      childLastName: detail.childLastName,
      clubId: detail.clubId,
      teamId: detail.teamId,
      teamName: detail.teamName,
      teamLogo: getImageUrl(detail.teamLogo),
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
  // todo: detail.childParentSub can be null
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
  const [deviceIds, language] = await Promise.all([getDeviceIds(sub), getUserLanguage(sub)]);

  await Promise.all([
    pushNotifications.send(language, deviceIds, type, detail),
    notificationsModel.create(detail.childSub, {
      type,
      attributes: objToKeyValueArray({
        parentUserId: detail.parentSub,
        parentFirstName: detail.parentFirstName,
        parentLastName: detail.parentLastName,
        parentPhoto: getImageUrl(detail.parentPhoto),
      }),
    }),
    notificationsModel.create(detail.parentSub, {
      type,
      attributes: objToKeyValueArray({
        childUserId: detail.childSub,
        childFirstName: detail.childFirstName,
        childLastName: detail.childLastName,
        childPhoto: getImageUrl(detail.childPhoto),
      }),
    }),
    notificationsModel.delete(
      detail.parentSub,
      NotificationType.InviteParent,
      objToKeyValueArray({
        childUserId: detail.childSub,
      }),
    ),
  ]);
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
  if (parent && parent.sub !== detail.recipientSub) {
    /**
     * Add notification for parent
     */
    const { sub: parentSub } = parent;
    const deviceIdsParent = await getDeviceIds(parentSub);
    const languageParent = await getUserLanguage(parentSub);

    await pushNotifications.send(
      languageParent,
      deviceIdsParent,
      NotificationType.ChildSendMoneyRequest,
      detail,
    );

    await notificationsModel.create(parentSub, {
      type: NotificationType.ChildSendMoneyRequest,
      attributes: objToKeyValueArray({
        childFirstName: detail.senderFirstName,
        childLastName: detail.senderLastName,
        childPhoto: detail.senderPhoto,
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
      requestId: detail.requestId,
      senderUserId: detail.senderSub,
      senderEmail: detail.senderEmail,
      senderFirstName: detail.senderFirstName,
      senderLastName: detail.senderLastName,
      senderPhoto: detail.senderPhoto,
      senderWalletId: detail.senderWalletId,
      amount: detail.amount,
      note: detail.note,
      transferTag: `from:${detail.recipientSub},to:${detail.senderSub}`,
    }),
  });
};

const getMoneyRequest = async (requestId: string) => {
  const pk = `money-request#${requestId}`;
  const sk = 'metadata';
  const { Item } = await dynamoHelper.getItem(pk, sk);
  return Item;
};

const rejectOrApproveMoneyRequest = async (
  type: NotificationType,
  { senderSub, recipientSub, requestId }: NotificationRejectMoneyRequest,
) => {
  await notificationsModel.delete(
    recipientSub,
    NotificationType.SendMoneyRequest,
    objToKeyValueArray({ requestId }),
  );

  const [
    senderUser,
    recipientUser,
    senderUserDeviceIds,
    recipientUserDeviceIds,
    moneyRequest,
  ] = await Promise.all([
    getUser(senderSub),
    getUser(recipientSub),
    getDeviceIds(senderSub),
    getDeviceIds(recipientSub),
    getMoneyRequest(requestId),
  ]);

  const senderUserLanguage = getUserLanguageFromUserData(senderUser);
  const recipientUserLanguage = getUserLanguageFromUserData(recipientUser);

  const detail = {
    senderFirstName: senderUser.firstName,
    senderLastName: senderUser.lastName,
    senderPhoto: getImageUrl(senderUser.photo),
    recipientFirstName: recipientUser.firstName,
    recipientLastName: recipientUser.lastName,
    recipientPhoto: getImageUrl(recipientUser.photo),
    amount: moneyRequest.amount,
  };

  /**
   * To sender - your request was approved/rejected
   */
  await pushNotifications.send(senderUserDeviceIds, senderUserLanguage, type, {
    name: `${detail.recipientFirstName} ${detail.recipientLastName}`,
    amount: detail.amount,
  });

  await notificationsModel.create(senderSub, {
    type,
    attributes: objToKeyValueArray({
      recipientFirstName: detail.recipientFirstName,
      recipientLastName: detail.recipientLastName,
      recipientPhoto: detail.recipientPhoto,
      amount: detail.amount,
    }),
  });

  if (type === NotificationType.RejectMoneyRequest) {
    /**
     * To recipient - You denied money request
     */
    // await pushNotifications.send(recipientUserDeviceIds, recipientUserLanguage, type, {
    //   name: `${detail.senderFirstName} ${detail.senderLastName}`,
    //   amount: detail.amount,
    // });
    // await notificationsModel.create(recipientSub, {
    //   type,
    //   attributes: objToKeyValueArray({
    //     senderFirstName: detail.senderFirstName,
    //     senderLastName: detail.senderLastName,
    //     senderPhoto: detail.senderPhoto,
    //     amount: detail.amount,
    //   }),
    // });
  }
};

const cardLockChanged = async (detail: any) => {
  console.log(detail);
  const [card] = detail.cards;
  const treezorUserId = card.userId;
  const user = await getUserByTreezorUserId(treezorUserId);
  if (user) {
    // todo: promise.all
    const sub = user.pk.replace('user#', '');
    const deviceIds = await getDeviceIds(sub);
    const language = await getUserLanguage(sub);
    const { maskedPan, statusCode, cardId, walletId } = card;

    await pushNotifications.send(language, deviceIds, NotificationType.CardLockChanged, card);
    await notificationsModel.create(sub, {
      type: NotificationType.CardLockChanged,
      attributes: objToKeyValueArray({
        maskedPan,
        statusCode,
        cardId,
        walletId,
      }),
    });
  }
};

const cardLimitsChanged = async (detail: any) => {
  console.log(detail);
  const [card] = detail.cards;
  const treezorUserId = card.userId;
  const user = await getUserByTreezorUserId(treezorUserId);
  if (user) {
    // todo: promise.all
    const sub = user.pk.replace('user#', '');
    const deviceIds = await getDeviceIds(sub);
    const language = await getUserLanguage(sub);
    const {
      maskedPan,
      cardId,
      walletId,
      limitAtmYear,
      limitAtmMonth,
      limitAtmWeek,
      limitAtmDay,
      limitAtmAll,
      limitPaymentYear,
      limitPaymentMonth,
      limitPaymentWeek,
      limitPaymentDay,
      limitPaymentAll,
    } = card;

    await pushNotifications.send(language, deviceIds, NotificationType.CardLimitChanged, card);
    await notificationsModel.create(sub, {
      type: NotificationType.CardLimitChanged,
      attributes: objToKeyValueArray({
        maskedPan,
        cardId,
        walletId,
        limitAtmYear,
        limitAtmMonth,
        limitAtmWeek,
        limitAtmDay,
        limitAtmAll,
        limitPaymentYear,
        limitPaymentMonth,
        limitPaymentWeek,
        limitPaymentDay,
        limitPaymentAll,
      }),
    });
  }
};

const getDetailsByTransferTag = (
  transferTag: string,
): { type: TransferType; id?: string; from?: string; to?: string } | null => {
  const matchP2P = transferTag.match(/^from:(?<from>[a-z0-9-]{36}),to:(?<to>[a-z0-9-]{36})$/);

  if (transferTag.startsWith('event:')) {
    return {
      type: TransferType.Event,
      id: transferTag.replace('event:', ''),
    };
  } else if (matchP2P) {
    return {
      type: TransferType.P2P,
      from: matchP2P.groups?.from,
      to: matchP2P.groups?.to,
    };
  }

  return null;
};

const treezorTransferUpdate = async (detail: any) => {
  console.log(detail);
  const [transfer]: Transfer[] = detail.transfers;

  // TODO: continue only if (transfer.transferStatus === 'VALIDATED')
  const { walletId, transferTag, amount, beneficiaryWalletId, transferId } = transfer;
  const transferDetails = getDetailsByTransferTag(transferTag);

  if (transferDetails?.type === TransferType.P2P) {
    const { from, to } = transferDetails;
    if (!from || !to) {
      console.error('P2P transfer have invalid data', transferDetails, transfer);
      return;
    }
    await moneyReceivedP2P(from, to, amount, transferTag);
  }
};

const moneyReceivedP2P = async (
  /**
   * Send money
   */
  fromUserId: string,
  /**
   * Receive money
   */
  toUserId: string,
  amount: string,
  transferTag: string,
) => {
  const [
    fromUser,
    toUser,
    fromUserParent,
    toUserParent,
    fromUserDeviceIds,
    toUserDeviceIds,
  ] = await Promise.all([
    getUser(fromUserId),
    getUser(toUserId),
    getParentUser(fromUserId),
    getParentUser(toUserId),
    getDeviceIds(fromUserId),
    getDeviceIds(toUserId),
  ]);

  const fromUserLanguage = getUserLanguageFromUserData(fromUser);
  const toUserLanguage = getUserLanguageFromUserData(toUser);

  const detail = {
    senderFirstName: fromUser.firstName,
    senderLastName: fromUser.lastName,
    senderPhoto: getImageUrl(fromUser.photo),
    recipientFirstName: toUser.firstName,
    recipientLastName: toUser.lastName,
    recipientPhoto: getImageUrl(toUser.photo),
    amount,
  };

  /**
   * Notification to money sender - fromUserId
   */
  await pushNotifications.send(
    fromUserLanguage,
    fromUserDeviceIds,
    NotificationType.SendMoney,
    detail,
  );
  await notificationsModel.create(fromUserId, {
    type: NotificationType.SendMoney,
    attributes: objToKeyValueArray({
      recipientFirstName: detail.recipientFirstName,
      recipientLastName: detail.recipientLastName,
      recipientPhoto: detail.recipientPhoto,
      amount: detail.amount,
    }),
  });

  /**
   * Notification to money recipient
   */
  await pushNotifications.send(
    toUserLanguage,
    toUserDeviceIds,
    NotificationType.ReceivedMoney,
    detail,
  );
  await notificationsModel.create(toUserId, {
    type: NotificationType.ReceivedMoney,
    attributes: objToKeyValueArray({
      senderFirstName: detail.senderFirstName,
      senderLastName: detail.senderLastName,
      senderPhoto: detail.senderPhoto,
      amount: detail.amount,
    }),
  });

  if (toUserParent && toUserId !== toUserParent.sub) {
    /**
     * Notify <toUserParent> - your child received money
     */
    const { sub: parentSub } = toUserParent;
    const deviceIdsParent = await getDeviceIds(parentSub);
    const languageParent = await getUserLanguage(parentSub);

    await pushNotifications.send(
      languageParent,
      deviceIdsParent,
      NotificationType.ChildReceivedMoney,
      detail,
    );

    await notificationsModel.create(parentSub, {
      type: NotificationType.ChildReceivedMoney,
      attributes: objToKeyValueArray({
        childFirstName: detail.recipientFirstName,
        childLastName: detail.recipientLastName,
        childPhoto: detail.recipientPhoto,
        senderFirstName: detail.senderFirstName,
        senderLastName: detail.senderLastName,
        amount: detail.amount,
      }),
    });
  }

  if (fromUserParent) {
    /**
     * Notify <fromUserParent> - your child sent money
     */
    const { sub: parentSub } = fromUserParent;
    const deviceIdsParent = await getDeviceIds(parentSub);
    const languageParent = await getUserLanguage(parentSub);

    await pushNotifications.send(
      languageParent,
      deviceIdsParent,
      NotificationType.ChildSendMoney,
      detail,
    );

    await notificationsModel.create(parentSub, {
      type: NotificationType.ChildSendMoney,
      attributes: objToKeyValueArray({
        childFirstName: detail.senderFirstName,
        childLastName: detail.senderLastName,
        childPhoto: detail.senderPhoto,
        recipientFirstName: detail.recipientFirstName,
        recipientLastName: detail.recipientLastName,
        amount: detail.amount,
      }),
    });
  }
};

export const handler: EventBridgeHandler<any, any, any> = async (event) => {
  const { detail } = event;
  const type: NotificationType | WebhookEvent = event['detail-type'];
  console.log(type, detail);

  switch (type) {
    case NotificationType.SendTeamInvitation:
      await sendTeamInvitation(type, detail);
      break;

    case NotificationType.DeclineTeamInvitation:
      await sendTeamInvitation(type, detail);
      break;

    case NotificationType.RejectTeamInvitationByParent:
      await sendTeamInvitationByParent(type, detail);
      break;

    case NotificationType.AcceptTeamInvitation:
      await sendTeamInvitation(type, detail);
      break;

    case NotificationType.ApproveTeamInvitationByParent:
      await sendTeamInvitationByParent(type, detail);
      break;

    case NotificationType.ChildSendTeamInvitation:
      await childSendTeamInvitation(type, detail);
      break;

    case NotificationType.SendMoneyRequest:
      await sendSendMoneyRequest(type, detail);
      break;

    case NotificationType.RejectMoneyRequest:
    case NotificationType.ApproveMoneyRequest:
      await rejectOrApproveMoneyRequest(type, detail);
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

    case WebhookEvent.card_lockunlock:
      await cardLockChanged(detail);
      break;

    case WebhookEvent.card_limits:
      await cardLimitsChanged(detail);
      break;

    case WebhookEvent.transfer_update:
    case WebhookEvent.transfer_create:
      await treezorTransferUpdate(detail);
      break;

    default:
      console.warn(`Unhandled notification: ${type}`);
      break;
  }
};
