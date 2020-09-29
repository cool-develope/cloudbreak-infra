// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import {
  Image,
  File,
  Event,
  Post,
  RepeatType,
  FieldName,
  EventRecord,
  EventTarget,
  AttachmentItemRecord,
} from './types';

const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME, IMAGES_DOMAIN, ES_DOMAIN } = process.env;

const incrementField = (pk: string, sk: string, fieldName: string, value: number = 1) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: { pk, sk },
    UpdateExpression: `SET ${fieldName} = ${fieldName} + :v`,
    ExpressionAttributeValues: {
      ':v': value,
    },
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

const getTargetObject = (targetItem: string[] = []) => targetItem.map((id) => ({ id, name: 'Todo soon' }));

const getTypeEventTarget = (metadata: EventRecord): EventTarget => ({
  country: metadata.targetCountry || '',
  federation: getTargetObject(metadata.targetFederation),
  club: getTargetObject(metadata.targetClub),
  discipline: metadata.targetDiscipline || [],
  team: getTargetObject(metadata.targetTeam),
  userRole: metadata.targetUserRole,
});

const getTypeEvent = (metadata: EventRecord): Event => {
  const {
    pk,
    title,
    description,
    image,
    startDate,
    endDate,
    address,
    discipline,
    price,
    likesCount,
    viewsCount,
    acceptedCount,
    ownerUserId,
  } = metadata;

  return {
    id: pk.replace('event#', ''),
    title,
    description,
    image: getTypeImage(image),
    startDate,
    endDate,
    address,
    discipline,
    price,
    likesCount,
    viewsCount,
    acceptedCount,
    author: {
      id: ownerUserId,
    },
    repeatType: (metadata.repeatType || RepeatType.None) as RepeatType,
    target: getTypeEventTarget(metadata),
  };
};

const getTypePost = (metadata: EventRecord): Post => {
  const {
    pk,
    title,
    description,
    image,
    attachment,
    likesCount,
    viewsCount,
    ownerUserId,
  } = metadata;

  return {
    id: pk.replace('event#', ''),
    title,
    description,
    image: getTypeImage(image),
    attachment: getTypeFile(attachment),
    likesCount,
    viewsCount,
    author: {
      id: ownerUserId,
    },
    target: getTypeEventTarget(metadata),
  };
};

const getTypeImage = (image: string = '') => ({
  url: image ? `https://${IMAGES_DOMAIN}/${image}` : '',
});

const getTypeFile = (attachment: any[] = []): File[] =>
  attachment.map(({ key, size }: AttachmentItemRecord) => ({
    url: key ? `https://${IMAGES_DOMAIN}/${key}` : '',
    size,
  }));

export const handler: Handler = async (event) => {
  const {
    arguments: { eventId },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;
  const pk = `event#${eventId}`;
  const sk = 'metadata';
  let result: Event | Post | null = null;

  // @ts-ignore
  const [getItemResult, incrementFieldResult] = await Promise.allSettled([
    getItem(pk, sk),
    incrementField(pk, sk, 'viewsCount'),
  ]);

  const Item = getItemResult.value?.Item;

  if (!Item) {
    // Event not found
  } else if (field === FieldName.event || field === FieldName.eventPrivate) {
    result = getTypeEvent(Item);
  } else if (field === FieldName.post || field === FieldName.postPrivate) {
    result = getTypePost(Item);
  }

  return result;
};
