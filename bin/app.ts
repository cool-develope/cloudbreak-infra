#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AcmStack } from '../lib/acm-stack';
import { TableStack } from '../lib/table-stack';
import { EventsStack } from '../lib/events-stack';

const app = new cdk.App();

/**
 * Register certificates in US for CloudFron
 */
new AcmStack(app, 'acm-us-stack', {
  env: {
    region: 'us-east-1',
  },
});

/**
 * Create DynamoDB tables
 */
new TableStack(app, 'table-stack');
});


new EventsStack(app, 'events-stack', {});
