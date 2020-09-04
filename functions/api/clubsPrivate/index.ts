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
      { id: '10-00', name: 'Club 1', logo: {url: 'https://images.dev.tifo-sport.com/demo-club-logo.png'} },
      { id: '10-01', name: 'Club 2', logo: {url: 'https://images.dev.tifo-sport.com/demo-club-logo.png'} },
    ],
  };
};
