// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

const { MAIN_TABLE_NAME, IMAGES_DOMAIN } = process.env;

export const handler: Handler = async (event) => {
  const {
    identity: { sub },
    info: { fieldName },
  } = event;

  const cardTypes = [
    {
      id: '16b33ed3-29ce-4bd1-bc98-e33285441f9b',
      name: 'Free card',
      description: 'This card is gratis, you will use it safely, with limitations.',
      limitMonth: 600,
      limitWeek: 150,
    },
  ];

  return cardTypes;
};
