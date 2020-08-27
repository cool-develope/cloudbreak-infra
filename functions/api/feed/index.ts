// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import { EventType, Image, File, Event, Post, FeedConnection, FeedFilterInput } from './types';

const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME, IMAGES_DOMAIN } = process.env;

const getItems = (pk: string, sk: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    FilterExpression: 'begins_with(pk, :pk) and sk = :sk',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': sk,
    },
  };

  return db.scan(params).promise();
};

const getTypeEvent = ({
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
}: any): Event => ({
  __typename: EventType.Event,
  id: pk.replace('event#', ''),
  title,
  description,
  image: getTypeImage(pk.replace('event#', ''), image),
  startDate,
  endDate,
  address,
  discipline,
  price,
  likesCount,
  viewsCount,
});

const getTypePost = ({
  pk,
  title,
  description,
  image,
  attachment,
  likesCount,
  viewsCount,
}: any): Post => ({
  __typename: EventType.Post,
  id: pk.replace('event#', ''),
  title,
  description,
  image: getTypeImage(image),
  attachment: getTypeFile(attachment),
  likesCount,
  viewsCount,
});

const getTypeFeed = (items: any[]): FeedConnection => {
  const feedItems = items.map((item) =>
    item.eventType === EventType.Event ? getTypeEvent(item) : getTypePost(item),
  );

  return {
    items: feedItems,
  };
};

const getTypeImage = (image: string = '') => ({
  url: image ? `https://${IMAGES_DOMAIN}/${image}` : '',
});

const getTypeFile = (attachment: string = '') => ({
  url: attachment ? `https://${IMAGES_DOMAIN}/${attachment}` : '',
});

export const handler: Handler = async (event) => {
  const {
    arguments: { filter, limit, after },
    identity: { sub },
    info: { fieldName },
  } = event;

  /**
   * Query feed:
   */
  const { Items } = await getItems('event#', 'metadata');
  const feed = getTypeFeed(Items);
  return feed;
};
