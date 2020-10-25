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
  EventsConnection,
  FeedFilterInput,
  FeedPrivateFilterInput,
  MyEventsFilterInput,
  FieldName,
  EventRecord,
  AttachmentItemRecord,
  EventOrganization,
  OrganizationType,
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
              wildcard: {
                title: {
                  value: `*${search}*`,
                },
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

const getEsQueryByArray = (propertyName: string, values?: string[]) =>
  values && values.length
    ? {
        bool: {
          should: values.map((value) => ({
            match: {
              [propertyName]: value,
            },
          })),
        },
      }
    : null;

const getMyEventsQuery = (filter: MyEventsFilterInput = {}, sub: string) => {
  const { startDateAfter, startDateBefore, endDateAfter, endDateBefore } = filter;
  const filterByStartDate = getQueryByDate('startDate', startDateAfter, startDateBefore);
  const filterByEndDate = getQueryByDate('endDate', endDateAfter, endDateBefore);
  const filterByEventType = getQueryByMatch('eventType', EventType.Event);
  const filterByMe = { match: { participants: sub } };

  const must = [filterByMe, filterByStartDate, filterByEndDate, filterByEventType].filter(
    (f) => !!f,
  );

  const query = must.length
    ? {
        bool: {
          must,
        },
      }
    : null;

  return query;
};

const getUpcomingEventsQuery = () => {
  const startDateAfter = new Date().toISOString();
  const startDateBefore = new Date(2022, 1, 1).toISOString();
  const filterByStartDate = getQueryByDate('startDate', startDateAfter, startDateBefore);
  const filterByEventType = getQueryByMatch('eventType', EventType.Event);

  const must = [filterByStartDate, filterByEventType].filter((f) => !!f);

  const query = must.length
    ? {
        bool: {
          must,
        },
      }
    : null;

  return query;
};

const getFeedPrivateQuery = (filter: FeedPrivateFilterInput = {}, sub: string) => {
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

  const filterByDiscipline = getEsQueryByArray('targetDiscipline', discipline);
  const filterByFederation = getEsQueryByArray('targetFederation', federation);
  const filterByClub = getEsQueryByArray('targetClub', club);
  const filterByTeam = getEsQueryByArray('targetTeam', team);

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
    filterByDiscipline,
    filterByFederation,
    filterByClub,
    filterByTeam,
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

const search = async ({
  query,
  limit,
  from,
  sort,
}: {
  query: any;
  limit: number;
  from: number;
  sort: any[];
}) => {
  try {
    const queryFilter = query ? { query } : null;

    const result = await es.search({
      index: 'events',
      body: {
        from,
        size: limit,
        ...queryFilter,
        sort,
      },
    });

    return result;
  } catch (err) {
    console.error(JSON.stringify(err, null, 2));
    return { body: null };
  }
};

const getEsTypeEvent = (metadata: any): Event => {
  const {
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
  } = metadata;

  return {
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
    organization: getTypeEventOrganization(metadata),
  };
};

const getEsTypePost = (metadata: any): Post => {
  const {
    id,
    title,
    description,
    image,
    attachment,
    likesCount,
    viewsCount,
    ownerUserId,
    createdAt,
  } = metadata;

  return {
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
    createDate: createdAt,
    organization: getTypeEventOrganization(metadata),
  };
};

const getTypeEventOrganization = ({ clubId, federationId }: EventRecord): EventOrganization => ({
  id: clubId || federationId || '',
  type: federationId ? OrganizationType.Federation : OrganizationType.Club,
});

const getEsFeedConnection = (items: any[], totalCount: number): FeedConnection => ({
  items: items.map((item) =>
    item.eventType === EventType.Event ? getEsTypeEvent(item) : getEsTypePost(item),
  ),
  totalCount,
});

const getEsEventsConnection = (items: any[], totalCount: number): EventsConnection => ({
  items: items.map((item) => getEsTypeEvent(item)),
  totalCount,
});

const getTypeImage = (image: string = ''): Image => ({
  url: image ? `https://${IMAGES_DOMAIN}/${image}` : '',
});

const getTypeFile = (attachment: any[] = []): File[] =>
  attachment.map(({ key, size }: AttachmentItemRecord) => ({
    url: key ? `https://${IMAGES_DOMAIN}/${key}` : '',
    key,
    size,
  }));

export const handler: Handler = async (event): Promise<FeedConnection | EventsConnection> => {
  const {
    arguments: { filter = {}, limit = 10, from = 0 },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;
  let query: any = null;
  let sort: any[] = [{ createdAt: 'desc' }, { _id: 'asc' }];

  if (field === FieldName.feed) {
    query = getFeedQuery(filter, sub);
  } else if (field === FieldName.feedPrivate) {
    query = getFeedPrivateQuery(filter, sub);
  } else if (field === FieldName.myEvents) {
    // TODO
    query = getMyEventsQuery(filter, sub);
    sort = [{ startDate: 'asc' }, { _id: 'asc' }];
  } else if (field === FieldName.upcomingEventsPrivate) {
    // TODO
    query = getUpcomingEventsQuery();
    sort = [{ startDate: 'asc' }, { _id: 'asc' }];
  }

  console.log({
    fieldName,
    filter: JSON.stringify(filter, null, 2),
    query: JSON.stringify(query, null, 2),
  });

  const esResult = await search({ query, limit, from, sort });
  const totalCount = esResult.body?.hits.total.value || 0;
  const items = prepareEsItems(esResult.body?.hits.hits);

  if (field === FieldName.feed || field === FieldName.feedPrivate) {
    const result = getEsFeedConnection(items, totalCount);
    return result;
  } else if (field === FieldName.myEvents || field === FieldName.upcomingEventsPrivate) {
    const result = getEsEventsConnection(items, totalCount);
    return result;
  }

  throw Error('Query not supported');
};
