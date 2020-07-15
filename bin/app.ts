#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AcmStack } from '../lib/acm-stack';
import { AppStack } from '../lib/app-stack';

const app = new cdk.App();

/**
 * Register certificates in US for CloudFron
 */
new AcmStack(app, 'acm-us-stack', {
  env: {
    region: 'us-east-1',
  },
});

new AppStack(app, 'prod', {
  prod: true,
  env: {
    region: 'eu-central-1',
  },
});

// new AppStack(app, 'dev', {
//   prod: false,
//   env: {
//     region: 'eu-central-1'
//   }
// });
