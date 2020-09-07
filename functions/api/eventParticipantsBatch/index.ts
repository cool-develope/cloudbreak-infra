// @ts-ignore
import * as AWS_RAW from 'aws-sdk';
import { Handler } from 'aws-lambda';
import { Client, ApiResponse, RequestParams } from '@elastic/elasticsearch';
import * as AWSXRay from 'aws-xray-sdk-core';

export interface Image {
  url: string;
}

export interface UserPublic {
  firstName?: string;
  lastName?: string;
  photo?: Image;
}

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN, ES_DOMAIN } = process.env;
const AWS = AWSXRay.captureAWS(AWS_RAW);
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });

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

  const users = new Map();

  const arrayOfItems = res.map((resItem) => resItem.Responses[MAIN_TABLE_NAME]);
  for (const items of arrayOfItems) {
    for (const item of items) {
      const userId = item.pk.replace('user#', '');
      users.set(userId, getTypeUser(item));
    }
  }

  return users;
};

const getTypeUser = ({ firstName, lastName, photo }: any): UserPublic => ({
  firstName,
  lastName,
  photo: getTypeImage(photo),
});

const getTypeImage = (photo: string = '') => ({
  url: photo ? `https://${IMAGES_DOMAIN}/${photo}` : '',
});

export const handler: Handler = async (event: any[]) => {
  /**
   * Get all events
   */
  const arrayOfPromises = event.map(({ id }) => es.get({ index: 'events', id }));
  const arrayOfEvents = await Promise.all(arrayOfPromises);

  /**
   * Collect uniq user PK
   */
  const PKs = new Set<string>();

  const eventParticipants = new Map<string, string[]>();
  for (const response of arrayOfEvents) {
    const { _id, _source = {} } = response.body;
    const { participants = [] } = _source;
    eventParticipants.set(_id, participants);

    for (const userID of participants) {
      PKs.add(`user#${userID}`);
    }
  }

  /**
   * Get metadata about each user
   */
  const users = await batchGet(PKs, 'metadata');

  /**
   * Result
   */
  const result = event.map((item: any) => {
    const participants = eventParticipants.get(item.id);
    return {
      items: participants?.map((userId) => users.get(userId)),
    };
  });

  console.log(result);
  return result;
};
