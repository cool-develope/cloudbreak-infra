// @ts-ignore
import * as AWS_RAW from 'aws-sdk';
import { Handler } from 'aws-lambda';
import * as AWSXRay from 'aws-xray-sdk-core';

export interface Image {
  url: string;
}

export interface Author {
  firstName?: string;
  lastName?: string;
  photo?: Image;
  organizationName?: string;
}

const AWS = AWSXRay.captureAWS(AWS_RAW);
const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN } = process.env;

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

  const authors = new Map();

  const arrayOfItems = res.map((resItem) => resItem.Responses[MAIN_TABLE_NAME]);
  for (const items of arrayOfItems) {
    for (const item of items) {
      const userId = item.pk.replace('user#', '');
      authors.set(userId, getTypeAuthor(item));
    }
  }

  return authors;
};

const getTypeAuthor = ({ firstName, lastName, photo }: any): Author => ({
  firstName,
  lastName,
  photo: getTypeImage(photo),
  organizationName: 'Horizon sport club',
});

const getTypeImage = (photo: string = '') => ({
  url: photo ? `https://${IMAGES_DOMAIN}/${photo}` : '',
});

export const handler: Handler = async (event: any[]) => {
  const arrayOfPk = event.map((item) => `user#${item.author.id}`);
  const PKs = new Set(arrayOfPk);

  const authors = await batchGet(PKs, 'metadata');

  const result = event.map((item: any) => authors.get(item.author.id));
  console.log(result);

  return result;
};
