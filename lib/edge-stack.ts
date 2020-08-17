import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
import { RetentionDays } from '@aws-cdk/aws-logs';

export class EdgeStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imagesOriginRequest = new lambda.Function(this, 'cloudfront-imagesOriginRequest', {
      functionName: 'cloudfront-imagesOriginRequest',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../', 'functions', 'cloudfront', 'imagesOriginRequest'),
      ),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      logRetention: RetentionDays.ONE_DAY,
      role: new iam.Role(this, 'AllowLambdaServiceToAssumeRole', {
        assumedBy: new iam.CompositePrincipal(
          new iam.ServicePrincipal('lambda.amazonaws.com'),
          new iam.ServicePrincipal('edgelambda.amazonaws.com'),
        ),
        managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')]
      })
    });

    new cdk.CfnOutput(this, 'imagesOriginRequest-arn', { value: imagesOriginRequest.currentVersion.functionArn });
  }
}
