// @ts-ignore
import * as AWS_RAW from 'aws-sdk';
import { Handler } from 'aws-lambda';
import { Client } from '@elastic/elasticsearch';
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
  FunctionEvent,
  FunctionEventBatch,
  CognitoClaims,
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
  const filterByClub = getEsQueryByArray('clubId', clubId ? [clubId] : []);
  const filterByTeam = getEsQueryByArray('targetTeam', teamId ? [teamId] : []);
  const filterByEventType = getQueryByMatch('eventType', eventType);

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

const getUpcomingEventsCount = async (clubId: string, teamId: string | null): Promise<number> => {
  const startDateAfter = new Date().toISOString();
  const startDateBefore = new Date(2022, 1, 1).toISOString();
  const filterByStartDate = getQueryByDate('startDate', startDateAfter, startDateBefore);
  const filterByEventType = getQueryByMatch('eventType', EventType.Event);
  const filterByClub = getEsQueryByArray('clubId', [clubId]);
  const filterByTeam = getEsQueryByArray('targetTeam', teamId ? [teamId] : []);

  const must = [filterByStartDate, filterByEventType, filterByClub, filterByTeam].filter(
    (f) => !!f,
  );

  const query = must.length
    ? {
        bool: {
          must,
        },
      }
    : null;

  const queryFilter = query ? { query } : null;

  try {
    const result = await es.count({
      index: 'events',
      body: {
        ...queryFilter,
      },
    });
    return result.body?.count;
  } catch (err) {
    console.error(JSON.stringify(err, null, 2));
    return 0;
  }
};

const getUpcomingEventsQuery = (claims: CognitoClaims) => {
  const { sub, clubId, federationId } = getClaimsData(claims);
  const club = clubId ? [clubId] : [];
  const federation = federationId ? [federationId] : [];

  const startDateAfter = new Date().toISOString();
  const startDateBefore = new Date(2022, 1, 1).toISOString();
  const filterByStartDate = getQueryByDate('startDate', startDateAfter, startDateBefore);
  const filterByEventType = getQueryByMatch('eventType', EventType.Event);
  const filterByFederation = getEsQueryByArray('federationId', federation);
  const filterByClub = getEsQueryByArray('clubId', club);

  const must = [filterByStartDate, filterByEventType, filterByFederation, filterByClub].filter(
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

const getFeedPrivateQuery = (filter: FeedPrivateFilterInput = {}, claims: CognitoClaims) => {
  let {
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

  const { sub, clubId, federationId } = getClaimsData(claims);
  const filterByClubIsEmpty = (club || []).length === 0;
  const filterByFederationIsEmpty = (federation || []).length === 0;

  if (clubId && filterByClubIsEmpty && myContent) {
    club = [clubId];
  }

  if (federationId && filterByFederationIsEmpty) {
    federation = [federationId];
  }

  const eventTypeValue = eventType?.length === 1 ? eventType[0] : undefined;

  const filterByStartDate = getQueryByDate('startDate', startDateAfter, startDateBefore);
  const filterByEndDate = getQueryByDate('endDate', endDateAfter, endDateBefore);
  const filterByCreatedAt = getQueryByDate('createdAt', createDateAfter, createDateBefore);
  const filterBySearch = getQueryBySearch(search);
  const filterByOwnerUserID = myContent ? getQueryByMatch('ownerUserId', sub) : null;
  const filterByDiscipline = getEsQueryByArray('discipline', discipline);
  const filterByFederation = getEsQueryByArray('federationId', federation);
  const filterByClub = getEsQueryByArray('clubId', club);
  const filterByTeam = getEsQueryByArray('targetTeam', team);
  const filterByEventType = getQueryByMatch('eventType', eventTypeValue);

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
    createdAt,
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
    createDate: createdAt,
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

const getClubUpcomingEventsCountBatch = async (event: FunctionEventBatch[]) => {
  const sub = event[0]?.identity.sub;
  const ids: string[] = event.map(({ source: { id } }) => id);

  const arrayOfPromises = ids.map((clubId) => {
    return getUpcomingEventsCount(clubId, null);
  });

  const listResults = await Promise.all(arrayOfPromises);
  const result = listResults.map((eventCount) => eventCount);
  return result;
};

const getTeamUpcomingEventsCountBatch = async (event: FunctionEventBatch[]) => {
  const sub = event[0]?.identity.sub;
  const ids: { clubId: string; id: string }[] = event.map(({ source: { id, clubId } }) => ({
    id,
    clubId,
  }));

  const arrayOfPromises = ids.map(({ id, clubId }) => {
    return getUpcomingEventsCount(clubId, id);
  });

  const listResults = await Promise.all(arrayOfPromises);
  const result = listResults.map((eventCount) => eventCount);
  return result;
};

const getClaimsData = (
  claims: CognitoClaims,
): { sub: string; groups: string[]; clubId: string | null; federationId: string | null } => {
  const {
    sub,
    ['cognito:groups']: groups = [],
    ['custom:clubs']: clubs = null,
    ['custom:federations']: federations = null,
  } = claims;

  const clubId = clubs && clubs.includes(',') ? clubs.split(', ')[0] : clubs || null;
  let federationId =
    federations && federations.includes(',') ? federations.split(', ')[0] : federations || null;

  return {
    sub,
    groups,
    clubId,
    federationId,
  };
};

export const handler: Handler = async (
  event: FunctionEvent | FunctionEventBatch[],
): Promise<any> => {
  if (Array.isArray(event)) {
    /**
     * Batch
     */
    const fieldName = event[0]?.fieldName;

    if (fieldName === FieldName.clubUpcomingEventsCount) {
      return await getClubUpcomingEventsCountBatch(event);
    } else if (fieldName === FieldName.teamUpcomingEventsCount) {
      return await getTeamUpcomingEventsCountBatch(event);
    }
  } else {
    const {
      arguments: { filter = {}, limit = 10, from = 0 },
      identity: { sub, claims },
      info: { fieldName },
    } = event;

    let query: any = null;
    let sort: any[] = [{ createdAt: 'desc' }, { _id: 'asc' }];

    if (fieldName === FieldName.feed) {
      query = getFeedQuery(filter, sub);
    } else if (fieldName === FieldName.feedPrivate) {
      query = getFeedPrivateQuery(filter, claims);
    } else if (fieldName === FieldName.myEvents) {
      query = getMyEventsQuery(filter, sub);
      sort = [{ startDate: 'asc' }, { _id: 'asc' }];
    } else if (fieldName === FieldName.upcomingEventsPrivate) {
      query = getUpcomingEventsQuery(claims);
      sort = [{ startDate: 'asc' }, { _id: 'asc' }];
    }

    const esResult = await search({ query, limit, from, sort });
    const totalCount = esResult.body?.hits.total.value || 0;
    const items = prepareEsItems(esResult.body?.hits.hits);

    if (fieldName === FieldName.feed || fieldName === FieldName.feedPrivate) {
      const result = getEsFeedConnection(items, totalCount);
      return result;
    } else if (fieldName === FieldName.myEvents || fieldName === FieldName.upcomingEventsPrivate) {
      const result = getEsEventsConnection(items, totalCount);
      return result;
    }
  }

  throw Error('Query not supported');
};
