// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

export interface PostReaction {
  liked: Boolean;
}

export interface EventReaction {
  liked: boolean;
  accepted: boolean;
  paid: boolean;
}

export enum EventType {
  Event = 'Event',
  Post = 'Post',
}

const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME = '' } = process.env;

const batchGet = async (PKs: Set<string>, sk: string): Promise<Map<string, any>> => {
  /**
   * Create Get request for each event
   */
  const getRequests = [...PKs].map((pk) => ({ pk, sk }));

  /**
   * Split items by batch max size (25)
   */
  const batchLimit = 25;
  const batchParams = [];
  while (getRequests.length) {
    const portionOfPutRequests = getRequests.splice(0, batchLimit);
    batchParams.push({
      RequestItems: {
        [MAIN_TABLE_NAME]: {
          Keys: portionOfPutRequests,
        },
      },
    });
  }

  /**
   * Run all batchWrite in parallel by portions
   */
  const arrayOfGet = batchParams.map((params) => db.batchGet(params).promise());
  const res = await Promise.all(arrayOfGet);

  const reactions = new Map();

  const arrayOfItems = res.map((resItem) => resItem.Responses[MAIN_TABLE_NAME]);
  for (const items of arrayOfItems) {
    for (const item of items) {
      const eventId = item.pk.replace('event#', '');
      reactions.set(eventId, getTypeEventReaction(item));
    }
  }

  return reactions;
};

const getTypeEventReaction = ({
  l,
  a,
  treezorTransferId,
}: {
  l: boolean;
  a: boolean;
  treezorTransferId?: number;
}): EventReaction => ({
  liked: l,
  accepted: a,
  paid: (treezorTransferId || 0) > 0,
});

export const handler: Handler = async (event: { source: any; identity: any }[]) => {
  const sub = event[0]?.identity?.sub;
  const arrayOfPk = event.map(({ source: { id } }) => `event#${id}`);
  const PKs = new Set(arrayOfPk);

  const reactions = await batchGet(PKs, `user#${sub}`);

  const result = event.map((item: any) => ({
    __typename: item.source.__typename,
    ...reactions.get(item.source.id),
  }));
  console.log(result);

  return result;
};
