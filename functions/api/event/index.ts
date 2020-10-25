// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import DynamoHelper from './dynamoHelper';
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
  EventOrganization,
  OrganizationType,
  IdName,
} from './types';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN, ES_DOMAIN } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);

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

const getItemsByIds = async (ids: string[], prefix: string): Promise<IdName[]> => {
  const arrayOfKeys = ids.map((id) => ({
    pk: `${prefix}#${id}`,
    sk: 'metadata',
  }));

  const result = await dynamoHelper.batchGet(arrayOfKeys, 'pk', (item) => ({
    id: item.pk.replace(prefix, ''),
    name: item.name,
  }));

  return [...result.values()];
};

const getTeamsByIds = async (ids: string[]): Promise<IdName[]> => {
  const result: IdName[] = [];

  for (const id of ids) {
    const { Items } = await dynamoHelper.queryItemsByIndex(`team#${id}`, 'club#', 'GSI1');
    if (Items && Items.length) {
      const [team] = Items;
      result.push({
        id: team.sk.replace('team#', ''),
        name: team.name,
      });
    }
  }

  return result;
};

const getTypeEventTarget = async (metadata: EventRecord): Promise<EventTarget> => {
  const [federation, club, team] = await Promise.all([
    getItemsByIds(metadata.targetFederation || [], 'federation'),
    getItemsByIds(metadata.targetClub || [], 'club'),
    getTeamsByIds(metadata.targetTeam || []),
  ]);

  return {
    country: metadata.targetCountry || '',
    discipline: metadata.targetDiscipline || [],
    userRole: metadata.targetUserRole,
    federation,
    club,
    team,
  };
};

const getTypeEvent = async (metadata: EventRecord): Promise<Event> => {
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

  const target = await getTypeEventTarget(metadata);

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
    target,
    organization: getTypeEventOrganization(metadata),
  };
};

const getTypeEventOrganization = ({ clubId, federationId }: EventRecord): EventOrganization => ({
  id: clubId || federationId || '',
  type: federationId ? OrganizationType.Federation : OrganizationType.Club,
});

const getTypePost = async (metadata: EventRecord): Promise<Post> => {
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

  const target = await getTypeEventTarget(metadata);

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
    target,
    organization: getTypeEventOrganization(metadata),
  };
};

const getTypeImage = (image: string = '') => ({
  url: image ? `https://${IMAGES_DOMAIN}/${image}` : '',
});

const getTypeFile = (attachment: any[] = []): File[] =>
  attachment.map(({ key, size }: AttachmentItemRecord) => ({
    url: key ? `https://${IMAGES_DOMAIN}/${key}` : '',
    key,
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
    field === FieldName.event || field === FieldName.post
      ? incrementField(pk, sk, 'viewsCount')
      : Promise.resolve(),
  ]);

  const Item = getItemResult.value?.Item;

  if (!Item) {
    // Event not found
  } else if (field === FieldName.event || field === FieldName.eventPrivate) {
    result = await getTypeEvent(Item);
  } else if (field === FieldName.post || field === FieldName.postPrivate) {
    result = await getTypePost(Item);
  }

  return result;
};
