#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AcmStack } from '../lib/acm-stack';
import { CognitoStack } from '../lib/cognito-stack';
import { ApiDomainStack } from '../lib/api-domain-stack';
import { ApiStack } from '../lib/api-stack';
import { WebSiteStack } from '../lib/website-stack';
import { StorageStack } from '../lib/storage-stack';
import { TableStack } from '../lib/table-stack';
import { EventsStack } from '../lib/events-stack';
import * as dotenv from 'dotenv';

dotenv.config({
  path: `.env.${process.env.TIFO_ENV || 'dev'}`,
});

const app = new cdk.App();

/**
 * Register certificates in US for CloudFront
 */
new AcmStack(app, 'acm-us-stack', {
  domainName: process.env.ZONE_NAME || '',
  env: {
    region: 'us-east-1',
  },
});

/**
 * Create Cognito
 */
new CognitoStack(app, 'cognito-stack', {
  signinUrl: process.env.SIGNIN_URL || '',
  imagesBucketName: process.env.IMAGES_BUCKET_NAME || '',
});

/**
 * Create DynamoDB tables
 */
new TableStack(app, 'table-stack', {
  dictionaryTableName: 'Dictionary',
  usersTableName: 'Users',
});

/**
 * Create GraphQL API
 */
new ApiStack(app, 'api-stack', {
  userPoolId: process.env.USER_POOL_ID || '',
  dictionaryTableName: 'Dictionary',
  usersTableName: 'Users',
});

/**
 * WebSite: https://admin.tifo-sport.com
 */
new WebSiteStack(app, 'admin-website-stack', {
  bucketName: process.env.ADMIN_BUCKET_NAME || '',
  bucketRefererHeader: '9c33fyuWNcB8bn9r24',
  zoneId: process.env.ZONE_ID || '',
  zoneName: process.env.ZONE_NAME || '',
  domain: `admin.${process.env.ZONE_NAME}`,
  certificateArn: process.env.US_CERTIFICATE_ARN || '',
});

/**
 * WebSite: https://mobile.tifo-sport.com
 */
new WebSiteStack(app, 'mobile-website-stack', {
  bucketName: process.env.MOBILE_BUCKET_NAME || '',
  bucketRefererHeader: '9c33fyuWNcB8bn9r24',
  zoneId: process.env.ZONE_ID || '',
  zoneName: process.env.ZONE_NAME || '',
  domain: `mobile.${process.env.ZONE_NAME}`,
  certificateArn: process.env.US_CERTIFICATE_ARN || '',
});

/**
 * Storage: https://images.tifo-sport.com
 */
new StorageStack(app, 'images-storage-stack', {
  bucketName: process.env.IMAGES_BUCKET_NAME || '',
  // zoneId: process.env.ZONE_ID || '',
  // zoneName: process.env.ZONE_NAME || '',
  // domain: `images.${process.env.ZONE_NAME}`,
  // certificateArn: process.env.US_CERTIFICATE_ARN || '',
});

/**
 * Create custom domain for AppSync
 */
new ApiDomainStack(app, 'api-domain-stack', {
  zoneId: process.env.ZONE_ID || '',
  zoneName: process.env.ZONE_NAME || '',
  apiDomain: `api.${process.env.ZONE_NAME}`,
  appSyncDomain: process.env.APPSYNC_DOMAIN || '',
  certificateArn: process.env.US_CERTIFICATE_ARN || '',
});

/**
 * EventBridge
 */
new EventsStack(app, 'events-stack', {});
