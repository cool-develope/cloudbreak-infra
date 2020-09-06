// @ts-ignore
import * as AWS from 'aws-sdk';
import { DynamoDBStreamHandler } from 'aws-lambda';
import { Client, ApiResponse, RequestParams } from '@elastic/elasticsearch';

interface Item {
  eventName?: 'INSERT' | 'MODIFY' | 'REMOVE';
  keys: {
    pk: string;
    sk: string;
  };
  data: any;
  oldData: any;
}

const { MAIN_TABLE_NAME, ES_DOMAIN } = process.env;
const es = new Client({ node: ES_DOMAIN });

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
    delete data.createdAt;

    if (eventName === 'INSERT' || eventName === 'MODIFY') {
      body.push({
        index: { _id: eventId },
      });
      body.push({
        ...data,
      });
    } else if (eventName === 'REMOVE') {
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

    console.log(result);
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

    console.log(result);
  }
};

export const handler: DynamoDBStreamHandler = async (event, context, callback: any) => {
  const eventMetadataItems: any[] = [];
  const eventUserItems: any[] = [];

  for (const record of event.Records) {
    const { eventName, dynamodb: { NewImage, OldImage, Keys } = {} } = record;
    const keys = AWS.DynamoDB.Converter.unmarshall(Keys);
    const data = AWS.DynamoDB.Converter.unmarshall(NewImage);
    const oldData = AWS.DynamoDB.Converter.unmarshall(OldImage);

    console.log(eventName, keys, JSON.stringify(data, null, 2));

    if (keys.pk.startsWith('event#') && keys.sk === 'metadata') {
      eventMetadataItems.push({ eventName, keys, data, oldData });
    }

    if (keys.pk.startsWith('event#') && keys.sk.startsWith('user#')) {
      eventUserItems.push({ eventName, keys, data, oldData });
    }
  }

  if (eventMetadataItems.length) {
    eventMetadataHandler(eventMetadataItems);
  }

  if (eventUserItems.length) {
    eventUserHandler(eventUserItems);
  }

  callback(null, `Successfully processed ${event.Records.length} records.`);
};
