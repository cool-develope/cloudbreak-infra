// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

const s3 = new AWS.S3();
const { IMAGES_BUCKET } = process.env;

enum UploadType {
  UserPhoto = 'UserPhoto',
  EventImage = 'EventImage',
  PostImage = 'PostImage',
  PostAttachment = 'PostAttachment',
}

interface UploadUrlPayload {
  uploadUrl: string;
  key: string;
}

const getS3Key = (type: UploadType, sub: string, fileName: string) => {
  switch (type) {
    case UploadType.UserPhoto:
      return `u/${sub}/photo/${fileName}`;
    case UploadType.EventImage:
    case UploadType.PostImage:
      return `event/i/${uuidv4()}/${fileName}`;
    case UploadType.PostAttachment:
      return `event/f/${uuidv4()}/${fileName}`;
  }
};

export const handler: Handler = async (event): Promise<UploadUrlPayload> => {
  const {
    arguments: { type, fileName },
    identity: { sub },
  } = event;

  const key = getS3Key(type as UploadType, sub, fileName);
  let uploadUrl = '';

  const params = {
    Bucket: IMAGES_BUCKET,
    Expires: 60, // 1 min
    Key: key,
  };

  try {
    uploadUrl = await s3.getSignedUrlPromise('putObject', params);
  } catch (err) {
    console.log({
      params,
      err,
    });
  }

  return {
    uploadUrl,
    key,
  };
};
