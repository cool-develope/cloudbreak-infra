// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

const s3 = new AWS.S3();
const { IMAGES_BUCKET } = process.env;

export const handler: Handler = async (event) => {
  const {
    arguments: { type, fileName },
    identity: { sub },
  } = event;

  const fileFolder = type === 'photo' ? 'photo' : 'other';

  const params = {
    Bucket: IMAGES_BUCKET,
    Expires: 60, // 1 min
    Key: `u/${sub}/${fileFolder}/${fileName}`,
  };

  try {
    const url = await s3.getSignedUrlPromise('putObject', params);
    return url;
  } catch (err) {
    console.log({
      params,
      err,
    });

    return 'Error';
  }
};
