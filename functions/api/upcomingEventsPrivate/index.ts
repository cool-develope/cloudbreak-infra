// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import { Client, ApiResponse, RequestParams } from '@elastic/elasticsearch';
import { Image, Event, UpcomingEventsPrivateConnection } from './types';

const { MAIN_TABLE_NAME, IMAGES_DOMAIN, ES_DOMAIN } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });

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
  acceptedCount,
  ownerUserId,
}: any): Event => ({
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
  author: {},
});

const getTypeUpcomingEventsPrivateConnection = (items: any[]): UpcomingEventsPrivateConnection => ({
  items: items.map((item) => getTypeEvent(item)),
});

const getTypeImage = (image: string = ''): Image => ({
  url: image ? `https://${IMAGES_DOMAIN}/${image}` : '',
});

export const handler: Handler = async (event) => {
  const {
    arguments: { limit },
    identity: { sub },
    info: { fieldName },
  } = event;

  const { Items } = await getItems('event#', 'metadata');
  const events = Items.filter((item: any) => item.type === 'Event');

  const result = getTypeUpcomingEventsPrivateConnection(events);
  return result;
};
