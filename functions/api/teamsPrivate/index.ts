// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

const { MAIN_TABLE_NAME, IMAGES_DOMAIN, ES_DOMAIN } = process.env;

export const handler: Handler = async (event) => {
  const {
    arguments: { filter, limit, from },
    identity: { sub },
    info: { fieldName },
  } = event;

  return {
    items: [
      { id: '10-00', name: 'Team 1' },
      { id: '10-01', name: 'Team 2' },
    ],
  };
};