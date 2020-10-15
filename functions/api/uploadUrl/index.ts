// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

const s3 = new AWS.S3();
const { IMAGES_BUCKET_NAME, DOCS_BUCKET_NAME } = process.env;

enum UploadType {
  UserPhoto = 'UserPhoto',
  UserPrivatePhoto = 'UserPrivatePhoto',
  EventImage = 'EventImage',
  PostImage = 'PostImage',
  PostAttachment = 'PostAttachment',
  Club = 'Club',
  Team = 'Team',
  Federation = 'Federation',
  Company = 'Company',
}

interface Event {
  arguments: {
    type: UploadType;
    fileName: string;
    id?: string;
  };
  identity: {
    sub: string;
  };
}

interface UploadUrlPayload {
  uploadUrl: string;
  key: string;
}

const getS3Key = (type: UploadType, sub: string, fileName: string, id?: string) => {
  switch (type) {
    case UploadType.UserPhoto:
      return `u/${sub}/photo/${fileName}`;
    case UploadType.UserPrivatePhoto:
      return `u/${id}/photo/${fileName}`;
    case UploadType.EventImage:
    case UploadType.PostImage:
      return `event/i/${uuidv4()}/${fileName}`;
    case UploadType.PostAttachment:
      return `event/f/${uuidv4()}/${fileName}`;
    case UploadType.Club:
      return `club/i/${uuidv4()}/${fileName}`;
    case UploadType.Company:
      return `user/${sub}/company/${fileName}`;
    case UploadType.Team:
      return `team/i/${uuidv4()}/${fileName}`;
    case UploadType.Federation:
      return `federation/i/${uuidv4()}/${fileName}`;
  }
};

export const handler: Handler = async (event: Event): Promise<UploadUrlPayload> => {
  const {
    arguments: { type, fileName, id },
    identity: { sub },
  } = event;

  const key = getS3Key(type, sub, fileName, id);
  let uploadUrl = '';

  const params = {
    Bucket: type === UploadType.Company ? DOCS_BUCKET_NAME : IMAGES_BUCKET_NAME,
    Expires: 120, // 1 min
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
