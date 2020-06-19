import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'user-pool', {
      userPoolName: 'users',
      selfSignUpEnabled: true,
      signInCaseSensitive: false,
      signInAliases: {
        username: false,
        email: true,
      },
      autoVerify: { email: true },
    });

    new cdk.CfnOutput(this, 'user-pool-id', { value: this.userPool.userPoolId });

    /**
     * Create a WebClient for web app
     */
    this.createWebClient();

    /**
     * Use Lambda to send custom messages
     */
    this.addTriggerCustomMessage();
  }

  createWebClient() {
    const webClient = new cognito.UserPoolClient(this, 'user-pool-web-client', {
      userPool: this.userPool,
      userPoolClientName: 'web-client',
      authFlows: {
        custom: true,
        refreshToken: true,
        userSrp: true,
      },
    });

    new cdk.CfnOutput(this, 'user-pool-web-client-id', { value: webClient.userPoolClientId });
  }

  addTriggerCustomMessage() {
    const cognitoCustomMessageFunction = new lambda.Function(this, 'cognitoCustomMessage', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'cognitoCustomMessage')),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment: {
        VERIFICATION_URL: `https://my-tifo.com/account/verification`,
        RECOVERY_URL: `https://my-tifo.com/account/recovery`,
      },
    });

    this.userPool.addTrigger(
      cognito.UserPoolOperation.CUSTOM_MESSAGE,
      cognitoCustomMessageFunction,
    );
  }
}
