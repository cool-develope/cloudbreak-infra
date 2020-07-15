import * as cdk from '@aws-cdk/core';
import { CognitoStack } from './cognito-stack';
import { ApiDomainStack } from './api-domain-stack';
import { ApiStack } from './api-stack';
import { WebSiteStack } from './website-stack';

interface AppStackProps extends cdk.StackProps {
  prod: boolean;
}

export class AppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    /**
     * TODO: replace with actual values
     */
    const usCertificateArn = 'arn:aws:acm:us-east-1:255378392675:certificate/344a8f98-51c8-491a-83eb-13c0afd7ba92';
    const appSyncDomain = 'cx3d66kwdnaaliqyz5t6zbltly.appsync-api.eu-central-1.amazonaws.com';
    const zoneId = 'Z078654110NBES23Z5I2Y';

    /**
     * Create Cognito
     */
    const cognito = new CognitoStack(this, 'cognito-stack');

    /**
     * Create GraphQL API
     */
    const api = new ApiStack(this, 'api-stack', {
      userPool: cognito.userPool,
    });

    /**
     * Create custom domain for AppSync
     */
    new ApiDomainStack(this, 'api-domain-stack', {
      zoneId,
      zoneName: 'tifo-sport.com',
      apiDomain: 'api.tifo-sport.com',
      appSyncDomain,
      certificateArn: usCertificateArn,
    });

    new WebSiteStack(this, 'admin-website-stack', {
      bucketName: 'admin.tifo-sport.com',
      bucketRefererHeader: '9c33fyuWNcB8bn9r24',
      zoneId,
      zoneName: 'tifo-sport.com',
      domain: 'admin.tifo-sport.com',
      certificateArn: usCertificateArn
    })
  }
}
