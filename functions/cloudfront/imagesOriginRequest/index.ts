import { CloudFrontRequestHandler } from 'aws-lambda';

const addRegionToUrl = (url: string) => url.replace('/u/', '/u/eu-central-1:');

export const handler: CloudFrontRequestHandler = (event, context, callback) => {
  const request = event.Records[0].cf.request;
  request.uri = addRegionToUrl(request.uri);
  callback(null, request);
};
