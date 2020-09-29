// @ts-ignore
import * as AWS_RAW from 'aws-sdk';
import { Handler } from 'aws-lambda';
import { Client, ApiResponse, RequestParams } from '@elastic/elasticsearch';
import * as AWSXRay from 'aws-xray-sdk-core';
import {
  EventType,
  Image,
  File,
  Event,
  Post,
  FeedConnection,
  FeedFilterInput,
  FieldName,
  EventRecord,
  AttachmentItemRecord,
} from './types';

const { MAIN_TABLE_NAME, IMAGES_DOMAIN, ES_DOMAIN } = process.env;
const AWS = AWSXRay.captureAWS(AWS_RAW);
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });

const prepareEsItems = (items: any[] = []) =>
  items.map(({ _id, _source }) => ({
    id: _id,
    ..._source,
  }));

const getFeedQuery = (filter: FeedFilterInput = {}, sub: string) => {
  if (!filter) {
    return null;
  }

  const { eventType, clubId, teamId } = filter;

  const filterByClub = getQueryByMatch('targetClub', clubId);
  const filterByTeam = getQueryByMatch('targetTeam', teamId);
  const filterByEventType =
    eventType && Array.isArray(eventType) && eventType.length === 1
      ? getQueryByMatch('eventType', eventType[0])
      : null;

  const must = [filterByClub, filterByTeam, filterByEventType].filter((f) => !!f);

  const query = must.length
    ? {
        bool: {
          must,
        },
      }
    : null;

  return query;
};

const getQueryByDate = (field: string, gte?: string, lte?: string) =>
  !gte && !lte
    ? null
    : {
        range: {
          [field]: {
            gte,
            lte,
          },
        },
      };

const getQueryBySearch = (search: string) =>
  !search
    ? null
    : {
        bool: {
          should: [
            {
              match: {
                title: search,
              },
            },
            {
              match: {
                description: search,
              },
            },
          ],
        },
      };

const getQueryByMatch = (field: string, value?: string) =>
  !value
    ? null
    : {
        match: {
          [field]: value,
        },
      };

const getQueryByDiscipline = (discipline?: string[]) =>
  discipline && discipline.length
    ? {
        bool: {
          should: discipline.map((value) => ({
            match: {
              discipline: value,
            },
          })),
        },
      }
    : null;

const getFeedPrivateQuery = (filter: FeedFilterInput = {}, sub: string) => {
  const {
    search = '',
    myContent,
    eventType,
    federation,
    club,
    team,
    discipline,
    createDateAfter,
    createDateBefore,
    startDateAfter,
    startDateBefore,
    endDateAfter,
    endDateBefore,
  } = filter;

  const filterByStartDate = getQueryByDate('startDate', startDateAfter, startDateBefore);
  const filterByEndDate = getQueryByDate('endDate', endDateAfter, endDateBefore);
  const filterByCreatedAt = getQueryByDate('createdAt', createDateAfter, createDateBefore);
  const filterBySearch = getQueryBySearch(search);
  const filterByOwnerUserID = myContent ? getQueryByMatch('ownerUserId', sub) : null;
  const filterByDiscipline = getQueryByDiscipline(discipline);
  const filterByEventType =
    Array.isArray(eventType) && eventType.length === 1
      ? getQueryByMatch('eventType', eventType[0])
      : null;

  const must = [
    filterByOwnerUserID,
    filterByStartDate,
    filterByEndDate,
    filterByCreatedAt,
    filterBySearch,
    filterByEventType,
  ].filter((f) => !!f);

  const query = must.length
    ? {
        bool: {
          must,
        },
      }
    : null;

  return query;
};

const search = async ({ query, limit, from }: { query: any; limit: number; from: number }) => {
  try {
    const queryFilter = query ? { query } : null;

    const result = await es.search({
      index: 'events',
      body: {
        from,
        size: limit,
        ...queryFilter,
        sort: [{ createdAt: 'desc' }, { _id: 'asc' }],
      },
    });

    return result;
  } catch (err) {
    console.log(JSON.stringify(err, null, 2));
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
  discipline = [],
  price,
  likesCount,
  viewsCount,
  acceptedCount,
  ownerUserId,
}: any): Event => ({
  __typename: EventType.Event,
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

const getEsTypePost = ({
  id,
  title,
  description,
  image,
  attachment,
  likesCount,
  viewsCount,
  ownerUserId,
}: any): Post => ({
  __typename: EventType.Post,
  id,
  title,
  description,
  image: getTypeImage(image),
  attachment: getTypeFile(attachment),
  likesCount,
  viewsCount,
  author: {
    id: ownerUserId,
  },
});

const getEsFeedConnection = (items: any[], totalCount: number): FeedConnection => ({
  items: items.map((item) =>
    item.eventType === EventType.Event ? getEsTypeEvent(item) : getEsTypePost(item),
  ),
  totalCount,
});

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
    arguments: { filter = {}, limit = 10, from = 0 },
    identity: { sub },
    info: { fieldName },
  } = event;

  console.log('Filter', filter);

  const field = fieldName as FieldName;
  let esResult: any = null;

  if (field === FieldName.feed) {
    const query = getFeedQuery(filter, sub);
    console.log('FeedQuery', JSON.stringify(query, null, 2));
    esResult = await search({ query, limit, from });
  } else if (field === FieldName.feedPrivate) {
    const query = getFeedPrivateQuery(filter, sub);
    console.log('FeedPrivateQuery', JSON.stringify(query, null, 2));
    esResult = await search({ query, limit, from });
  }

  const totalCount = esResult.body?.hits.total.value || 0;
  const items = prepareEsItems(esResult.body?.hits.hits);

  const result = getEsFeedConnection(items, totalCount);
  return result;
};
