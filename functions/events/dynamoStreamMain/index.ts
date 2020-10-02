// @ts-ignore
import * as AWS from 'aws-sdk';
import { DynamoDBStreamHandler, StreamRecord } from 'aws-lambda';
import { Client, ApiResponse, RequestParams } from '@elastic/elasticsearch';

interface Item {
  eventName: EventName;
  keys: {
    pk: string;
    sk: string;
  };
  data: any;
  oldData: any;
}

enum EventName {
  INSERT = 'INSERT',
  MODIFY = 'MODIFY',
  REMOVE = 'REMOVE',
}

interface Keys {
  pk: string;
  sk: string;
}

interface TeamUserRecord {
  pk: string;
  sk: string;
  role: string;
  createdAt: string;
  clubId: string;
  status: string;
}

const { MAIN_TABLE_NAME, ES_DOMAIN } = process.env;
const es = new Client({ node: ES_DOMAIN });
const db = new AWS.DynamoDB.DocumentClient();

const teamPattern = new RegExp('^team#[a-z0-9-]+$');
// const teamUserPattern = new RegExp('^team#[a-z0-9-]+user#[a-z0-9-]+$');
// const teamInvitationPattern = new RegExp('^team#[a-z0-9-]+invitation#[a-z0-9-]+$');

const clubMetadataHandler = async (items: Item[]) => {
  const body = [];
  for (const item of items) {
    const {
      eventName,
      keys: { pk, sk },
      data,
    } = item;
    const _id = pk.replace('club#', '');
    delete data.pk;
    delete data.sk;
    delete data.modifiedAt;

    if (eventName === EventName.INSERT) {
      body.push({
        index: { _id },
      });
      body.push({
        ...data,
      });
    } else if (eventName === EventName.MODIFY) {
      body.push({
        update: { _id },
      });
      body.push({
        doc: {
          ...data,
        },
        doc_as_upsert: true,
      });
    } else if (eventName === EventName.REMOVE) {
      body.push({
        delete: { _id },
      });
    }
  }

  if (body.length) {
    const result = await es.bulk({
      index: 'clubs',
      refresh: true,
      body,
    });

    console.log(JSON.stringify(result, null, 2));
  }
};

const usersHandler = async (items: Item[]) => {
  const body = [];
  for (const item of items) {
    const {
      eventName,
      keys: { pk, sk },
      data,
    } = item;

    const _id = pk.replace('user#', '');
    delete data.pk;
    delete data.sk;
    delete data.modifiedAt;

    if (eventName === EventName.INSERT) {
      body.push({
        index: { _id },
      });
      body.push({
        ...data,
      });
    } else if (eventName === EventName.MODIFY) {
      body.push({
        update: { _id },
      });
      body.push({
        doc: {
          ...data,
        },
        doc_as_upsert: true,
      });
    } else if (eventName === EventName.REMOVE) {
      body.push({
        delete: { _id },
      });
    }
  }

  if (body.length) {
    const result = await es.bulk({
      index: 'users',
      refresh: true,
      body,
    });

    console.log(JSON.stringify(result, null, 2));
  }
};

const teamsHandler = async (items: Item[]) => {
  const body = [];
  for (const item of items) {
    const {
      eventName,
      keys: { pk, sk },
      data,
    } = item;
    const clubId = pk.replace('club#', '');
    const teamId = sk.replace('team#', '');

    const _id = teamId;
    delete data.pk;
    delete data.sk;
    delete data.modifiedAt;
    data.clubId = clubId;

    if (eventName === EventName.INSERT) {
      body.push({
        index: { _id },
      });
      body.push({
        ...data,
      });
    } else if (eventName === EventName.MODIFY) {
      body.push({
        update: { _id },
      });
      body.push({
        doc: {
          ...data,
        },
        doc_as_upsert: true,
      });
    } else if (eventName === EventName.REMOVE) {
      body.push({
        delete: { _id },
      });
    }
  }

  if (body.length) {
    const result = await es.bulk({
      index: 'teams',
      refresh: true,
      body,
    });

    console.log(JSON.stringify(result, null, 2));
  }
};

const eventMetadataHandler = async (items: Item[]) => {
  const body = [];
  for (const item of items) {
    const {
      eventName,
      keys: { pk, sk },
      data,
    } = item;
    const eventId = pk.replace('event#', '');
    delete data.pk;
    delete data.sk;
    delete data.modifiedAt;

    if (eventName === EventName.INSERT) {
      body.push({
        index: { _id: eventId },
      });
      body.push({
        ...data,
      });
    } else if (eventName === EventName.MODIFY) {
      body.push({
        update: { _id: eventId },
      });
      body.push({
        doc: {
          ...data,
        },
        doc_as_upsert: true,
      });
    } else if (eventName === EventName.REMOVE) {
      body.push({
        delete: { _id: eventId },
      });
    }
  }

  if (body.length) {
    const result = await es.bulk({
      index: 'events',
      refresh: true,
      body,
    });

    console.log(JSON.stringify(result, null, 2));
  }
};

const eventUserHandler = async (items: Item[]) => {
  const body = [];
  for (const item of items) {
    const {
      eventName,
      keys: { pk, sk },
      data,
    } = item;
    const eventId = pk.replace('event#', '');
    const userId = sk.replace('user#', '');
    const { a: accepted } = data;

    if (accepted) {
      body.push({
        update: { _id: eventId },
      });
      body.push({
        script: {
          source:
            'if (ctx._source.participants == null) { ctx._source.participants = []; } ctx._source.participants.add(params.user);',
          lang: 'painless',
          params: {
            user: userId,
          },
        },
      });
    }
  }

  if (body.length) {
    const result = await es.bulk({
      index: 'events',
      refresh: true,
      body,
    });

    console.log(JSON.stringify(result, null, 2));
  }
};

const queryItemsByIndex = (sk: string, pk: string, indexName: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    IndexName: indexName,
    KeyConditionExpression: 'sk = :sk and begins_with(pk, :pk)',
    ExpressionAttributeValues: {
      ':sk': sk,
      ':pk': pk,
    },
  };

  return db.query(params).promise();
};

const getTeams = async (userId: string): Promise<TeamUserRecord[]> => {
  const { Items } = await queryItemsByIndex(`user#${userId}`, 'team#', 'GSI1');
  return Items.map(({ clubId, pk, role, status }: TeamUserRecord) => ({
    teamId: pk.replace('team#', ''),
    clubId,
    role,
    status,
  }));
};

const userTeamsHandler = async (items: Item[]) => {
  const body = [];
  for (const item of items) {
    const {
      eventName,
      keys: { pk, sk },
      data,
    } = item;
    const userId = sk.replace('user#', '');
    const teams = await getTeams(userId);
    const source = 'ctx._source.teams = params.teams;';

    if (source) {
      body.push({
        update: { _id: userId },
      });
      body.push({
        script: {
          source,
          lang: 'painless',
          params: {
            teams,
          },
        },
      });
    }
  }

  if (body.length) {
    const result = await es.bulk({
      index: 'users',
      refresh: true,
      body,
    });

    console.log(JSON.stringify(result, null, 2));
  }
};

export const handler: DynamoDBStreamHandler = async (event, context, callback: any) => {
  const eventMetadataItems: Item[] = [];
  const eventUserItems: Item[] = [];
  const clubMetadataItems: Item[] = [];
  const teams: Item[] = [];
  const users: Item[] = [];
  const userTeams: Item[] = [];

  for (const record of event.Records) {
    const { eventName, dynamodb: { NewImage, OldImage, Keys } = {} } = record as {
      eventName: EventName;
      dynamodb: StreamRecord;
    };

    const keys: Keys = AWS.DynamoDB.Converter.unmarshall(Keys);
    const data = AWS.DynamoDB.Converter.unmarshall(NewImage);
    const oldData = AWS.DynamoDB.Converter.unmarshall(OldImage);

    console.log(eventName, keys, JSON.stringify(data, null, 2));

    if (keys.pk.startsWith('event#') && keys.sk === 'metadata') {
      eventMetadataItems.push({ eventName, keys, data, oldData });
    }

    if (keys.pk.startsWith('event#') && keys.sk.startsWith('user#')) {
      eventUserItems.push({ eventName, keys, data, oldData });
    }

    if (keys.pk.startsWith('club#') && keys.sk === 'metadata') {
      clubMetadataItems.push({ eventName, keys, data, oldData });
    }

    if (keys.pk.startsWith('user#') && keys.sk === 'metadata') {
      users.push({ eventName, keys, data, oldData });
    }

    if (keys.pk.startsWith('team#') && keys.sk.startsWith('user#')) {
      userTeams.push({ eventName, keys, data, oldData });
    }

    if (keys.pk.startsWith('club#') && keys.sk.startsWith('team#')) {
      if (teamPattern.test(keys.sk)) {
        teams.push({ eventName, keys, data, oldData });
      }
    }
  }

  if (eventMetadataItems.length) {
    eventMetadataHandler(eventMetadataItems);
  }

  if (eventUserItems.length) {
    eventUserHandler(eventUserItems);
  }

  if (clubMetadataItems.length) {
    clubMetadataHandler(clubMetadataItems);
  }

  if (teams.length) {
    teamsHandler(teams);
  }

  if (users.length) {
    usersHandler(users);
  }

  if (userTeams.length) {
    userTeamsHandler(userTeams);
  }

  callback(null, `Successfully processed ${event.Records.length} records.`);
};
