// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import { Client, ApiResponse, RequestParams } from '@elastic/elasticsearch';
import { Image, Event, MyEventsConnection } from './types';

const { MAIN_TABLE_NAME, IMAGES_DOMAIN, ES_DOMAIN } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });

const prepareEsItems = (items: any[] = []) =>
  items.map(({ _id, _source }) => ({
    id: _id,
    ..._source,
  }));

const search = async ({
  filter,
  limit,
  from,
  sub,
}: {
  filter: any;
  limit: number;
  from: number;
  sub: string;
}) => {
  try {
    const { startDateAfter, startDateBefore, endDateAfter, endDateBefore } = filter;

    const result = await es.search({
      index: 'events',
      body: {
        from,
        size: limit,
        query: {
          bool: {
            must: [
              {
                match: {
                  participants: sub,
                },
              },
              {
                range: {
                  startDate: {
                    gte: startDateAfter,
                    lte: startDateBefore,
                  },
                },
              },
              {
                range: {
                  endDate: {
                    gte: endDateAfter,
                    lte: endDateBefore,
                  },
                },
              },
            ],
          },
        },
        sort: [{ startDate: 'asc' }, { 'title.keyword': 'asc' }],
      },
    });

    return result;
  } catch (err) {
    console.log(err);
    return { body: null };
  }
};

const getEsTypeEvent = ({
  id,
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
  id,
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
});

const getEsTypeMyEventsConnection = (items: any[], totalCount: number): MyEventsConnection => ({
  items: items.map((item) => getEsTypeEvent(item)),
  totalCount,
});

const getTypeImage = (image: string = ''): Image => ({
  url: image ? `https://${IMAGES_DOMAIN}/${image}` : '',
});

export const handler: Handler = async (event) => {
  const {
    arguments: { filter = {}, limit = 10, from = 0 },
    identity: { sub },
    info: { fieldName },
  } = event;

  const { body } = await search({ filter, limit, from, sub });
  const totalCount = body?.hits.total.value || 0;
  const items = prepareEsItems(body?.hits.hits);

  const result = getEsTypeMyEventsConnection(items, totalCount);
  return result;
};
