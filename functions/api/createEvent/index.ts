// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

import {
  FieldName,
  UserRole,
  EventType,
  Image,
  File,
  CreateEventInput,
  CreatePostInput,
  EventTargetInput,
  EventTarget,
  CreateEventPayload,
  CreatePostPayload,
  EventForAdmin,
  PostForAdmin,
  EventRecord,
} from './types';

const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME, IMAGES_DOMAIN } = process.env;

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

const getTargetObject = (targetItem: string[] = []) => targetItem.map((id) => ({ id, name: '' }));

const getTypeEvent = (metadata: EventRecord): EventForAdmin => ({
  id: metadata.pk.replace('event#', ''),
  title: metadata.title,
  description: metadata.description,
  image: getTypeImage(metadata.image),
  startDate: metadata.startDate,
  endDate: metadata.endDate,
  address: metadata.address,
  discipline: metadata.discipline,
  price: metadata.price,
  likesCount: metadata.likesCount,
  viewsCount: metadata.viewsCount,
  acceptedCount: metadata.acceptedCount,
  target: {
    country: metadata.targetCountry,
    federation: getTargetObject(metadata.targetFederation),
    club: getTargetObject(metadata.targetClub),
    discipline: metadata.targetDiscipline || [],
    team: getTargetObject(metadata.targetTeam),
    userRole: metadata.targetUserRole,
  },
});

const getTypePost = (metadata: EventRecord): PostForAdmin => ({
  id: metadata.pk.replace('event#', ''),
  title: metadata.title,
  description: metadata.description,
  image: getTypeImage(metadata.image),
  attachment: getTypeFile(metadata.attachment),
  likesCount: metadata.likesCount,
  viewsCount: metadata.viewsCount,
  target: {
    country: metadata.targetCountry || '',
    federation: getTargetObject(metadata.targetFederation),
    club: getTargetObject(metadata.targetClub),
    discipline: metadata.targetDiscipline,
    team: getTargetObject(metadata.targetTeam),
    userRole: metadata.targetUserRole,
  },
});

const getTypeImage = (image: string = '') => ({
  url: image ? `https://${IMAGES_DOMAIN}/${image}` : '',
});

const getTypeFile = (attachment: string = '') => ({
  url: attachment ? `https://${IMAGES_DOMAIN}/${attachment}` : '',
});

const getDefaultValues = (userId: string, eventType: EventType) => ({
  eventType,
  likesCount: 0,
  viewsCount: 0,
  createdAt: new Date().toISOString(),
  ownerUserId: userId,
  isDeleted: false,
});

const createEvent = async (
  userId: string,
  input: CreateEventInput,
): Promise<CreateEventPayload> => {
  const pk = `event#${uuidv4()}`;
  const {
    title,
    description = '',
    image,
    startDate,
    endDate,
    address = '',
    discipline = '',
    price,
    target,
  } = input;

  const metadata = {
    ...getDefaultValues(userId, EventType.Event),
    acceptedCount: 0, // for Event only
    title,
    description,
    image,
    startDate,
    endDate,
    address,
    discipline,
    price,
    targetCountry: target?.country,
    targetFederation: target?.federation,
    targetClub: target?.club,
    targetDiscipline: target?.discipline,
    targetTeam: target?.team,
    targetUserRole: target?.userRole,
  };

  const { Attributes } = await updateItem(pk, 'metadata', metadata);
  const event = getTypeEvent(Attributes);

  return {
    errors: [],
    event,
  };
};

const createPost = async (userId: string, input: CreatePostInput): Promise<CreatePostPayload> => {
  const pk = `event#${uuidv4()}`;
  const { title, description = '', image, attachment, target } = input;

  const metadata = {
    ...getDefaultValues(userId, EventType.Post),
    title,
    description,
    image,
    attachment,
    targetCountry: target?.country,
    targetFederation: target?.federation,
    targetClub: target?.club,
    targetDiscipline: target?.discipline,
    targetTeam: target?.team,
    targetUserRole: target?.userRole,
  };

  const { Attributes } = await updateItem(pk, 'metadata', metadata);
  const post = getTypePost(Attributes);

  return {
    errors: [],
    post,
  };
};

export const handler: Handler = async (event) => {
  const {
    arguments: { input },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;

  if (field === FieldName.createEvent) {
    /**
     * Mutation createEvent:
     */
    const payload = await createEvent(sub, input);
    return payload;
  } else if (field === FieldName.createPost) {
    /**
     * Mutation createPost:
     */
    const payload = await createPost(sub, input);
    return payload;
  }

  return null;
};
