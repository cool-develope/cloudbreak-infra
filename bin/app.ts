#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AppStack } from '../lib/app-stack';

const app = new cdk.App();

new AppStack(app, 'prod', {
  prod: true,
  env: {
    region: 'eu-central-1'
  }
});

// new AppStack(app, 'dev', {
//   prod: false,
//   env: {
//     region: 'eu-central-1'
//   }
// });