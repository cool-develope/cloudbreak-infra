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
    const id = pk.replace('event#', '');
    delete data.pk;
    delete data.sk;
    delete data.modifiedAt;
    delete data.createdAt;

    if (eventName === 'INSERT' || eventName === 'MODIFY') {
      body.push({
        index: { _id: id },
      });
      body.push({
        ...data,
      });
    } else if (eventName === 'REMOVE') {
      body.push({
        delete: { _id: id },
      });
    }
  }

  const result = await es.bulk({
    index: 'events',
    refresh: true,
    body,
  });

  console.log(result);
};

export const handler: DynamoDBStreamHandler = async (event, context, callback: any) => {
  const eventMetadataItems: any[] = [];

  for (const record of event.Records) {
    const { eventName, dynamodb: { NewImage, OldImage, Keys } = {} } = record;
    const keys = AWS.DynamoDB.Converter.unmarshall(Keys);
    const data = AWS.DynamoDB.Converter.unmarshall(NewImage);
    const oldData = AWS.DynamoDB.Converter.unmarshall(OldImage);

    console.log(keys, JSON.stringify(data, null, 2));

    if (keys.pk.startsWith('event#') && keys.sk === 'metadata') {
      eventMetadataItems.push({ eventName, keys, data, oldData });
    }
  }

  if (eventMetadataItems.length) {
    eventMetadataHandler(eventMetadataItems);
  }

  callback(null, `Successfully processed ${event.Records.length} records.`);
};
