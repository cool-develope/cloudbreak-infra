// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

import {
  FieldName,
  UserRole,
  EventType,
  RepeatType,
  Image,
  File,
  CreateEventInput,
  CreatePostInput,
  EventTargetInput,
  EventTarget,
  CreateEventPayload,
  CreatePostPayload,
  Event,
  Post,
  EventRecord,
  AttachmentItemRecord,
  Discipline,
  EventOrganization,
  OrganizationType,
} from './types';

const db = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const { MAIN_TABLE_NAME, IMAGES_DOMAIN, IMAGES_BUCKET } = process.env;

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

const describeFile = (s3Key: string) =>
  s3
    .headObject({
      Bucket: IMAGES_BUCKET,
      Key: s3Key,
    })
    .promise()
    .then(({ ContentLength }: any) => ({
      key: s3Key,
      size: ContentLength,
    }));

const getAttachmentEnriched = async (
  attachment: string[] = [],
): Promise<AttachmentItemRecord[]> => {
  const s3Promises = attachment.map((s3Key) => describeFile(s3Key));

  // @ts-ignore
  const s3Results = await Promise.allSettled(s3Promises);

  return s3Results
    .map(({ status, value }: { status: string; value: AttachmentItemRecord }) =>
      status === 'fulfilled' ? value : null,
    )
    .filter((v: AttachmentItemRecord) => !!v);
};

const getTargetObject = (targetItem: string[] = []) =>
  targetItem.map((id) => ({ id, name: 'Todo name' }));

const getTypeEventTarget = (metadata: EventRecord): EventTarget => ({
  country: metadata.targetCountry || '',
  federation: getTargetObject(metadata.targetFederation),
  club: getTargetObject(metadata.targetClub),
  discipline: metadata.targetDiscipline || [],
  team: getTargetObject(metadata.targetTeam),
  userRole: metadata.targetUserRole,
});

const getTypeEvent = (metadata: EventRecord): Event => ({
  id: metadata.pk.replace('event#', ''),
  title: metadata.title,
  description: metadata.description,
  image: getTypeImage(metadata.image),
  startDate: metadata.startDate,
  endDate: metadata.endDate,
  address: metadata.address,
  discipline: metadata.discipline || [],
  price: metadata.price,
  likesCount: metadata.likesCount,
  viewsCount: metadata.viewsCount,
  acceptedCount: metadata.acceptedCount,
  repeatType: (metadata.repeatType || RepeatType.None) as RepeatType,
  target: getTypeEventTarget(metadata),
  organization: getTypeEventOrganization(metadata),
});

const getTypePost = (metadata: EventRecord): Post => ({
  id: metadata.pk.replace('event#', ''),
  title: metadata.title,
  description: metadata.description,
  image: getTypeImage(metadata.image),
  attachment: getTypeFile(metadata.attachment),
  likesCount: metadata.likesCount,
  viewsCount: metadata.viewsCount,
  target: getTypeEventTarget(metadata),
  createDate: metadata.createdAt,
  organization: getTypeEventOrganization(metadata),
});

const getTypeEventOrganization = ({ clubId, federationId }: EventRecord): EventOrganization => ({
  id: clubId || federationId || '',
  type: federationId ? OrganizationType.Federation : OrganizationType.Club,
});

const getTypeImage = (image: string = ''): Image => ({
  url: image ? `https://${IMAGES_DOMAIN}/${image}` : '',
});

const getTypeFile = (attachment: AttachmentItemRecord[] = []): File[] =>
  attachment.map(({ key, size }) => ({
    url: key ? `https://${IMAGES_DOMAIN}/${key}` : '',
    key,
    size,
  }));

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
  const {
    id,
    title,
    description = '',
    image,
    startDate,
    endDate,
    address = '',
    discipline = [],
    price,
    repeatType = RepeatType.None,
    clubId,
    federationId,
    target,
  } = input;

  const errors: string[] = [];
  const pk = id ? `event#${id}` : `event#${uuidv4()}`;
  const defaultValues = id ? null : getDefaultValues(userId, EventType.Event);

  const metadata: any = {
    ...defaultValues,
    clubId,
    federationId,
    title,
    description,
    image,
    startDate,
    endDate,
    address,
    discipline,
    price,
    repeatType,
    targetCountry: target?.country,
    targetFederation: target?.federation,
    targetClub: target?.club,
    targetDiscipline: target?.discipline,
    targetTeam: target?.team,
    targetUserRole: target?.userRole,
    modifiedAt: new Date().toISOString(),
  };

  if (!id) {
    metadata.acceptedCount = 0; // for Event only
  }

  const { Attributes } = await updateItem(pk, 'metadata', metadata);
  const event = getTypeEvent(Attributes);

  return {
    errors,
    event,
  };
};

const validateInput = (fieldName: FieldName, { clubId, federationId }: any): string[] => {
  const errors: string[] = [];

  if (!clubId && !federationId) {
    errors.push('Required field: clubId or federationId');
  }

  return errors;
};

const createPost = async (userId: string, input: CreatePostInput): Promise<CreatePostPayload> => {
  const { id, title, description = '', image, attachment, target, clubId, federationId } = input;
  const attachmentEnriched = await getAttachmentEnriched(attachment);

  const errors: string[] = [];
  const pk = id ? `event#${id}` : `event#${uuidv4()}`;
  const defaultValues = id ? null : getDefaultValues(userId, EventType.Post);

  const metadata = {
    ...defaultValues,
    clubId,
    federationId,
    title,
    description,
    image,
    attachment: attachmentEnriched,
    targetCountry: target?.country,
    targetFederation: target?.federation,
    targetClub: target?.club,
    targetDiscipline: target?.discipline,
    targetTeam: target?.team,
    targetUserRole: target?.userRole,
    modifiedAt: new Date().toISOString(),
  };

  const { Attributes } = await updateItem(pk, 'metadata', metadata);
  const post = getTypePost(Attributes);

  return {
    errors,
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

  const errors: string[] = validateInput(FieldName.createPost, input);
  if (errors.length) {
    return { errors };
  }

  if (field === FieldName.createEvent || field === FieldName.updateEvent) {
    /**
     * Mutation createEvent:
     */
    const payload = await createEvent(sub, input);
    return payload;
  } else if (field === FieldName.createPost || field === FieldName.updatePost) {
    /**
     * Mutation createPost:
     */
    const payload = await createPost(sub, input);
    return payload;
  }

  return null;
};
