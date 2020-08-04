import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';

export interface CognitoStackProps extends cdk.StackProps {
  sesARN: string;
  verificationUrl: string;
  recoveryUrl: string;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;

  constructor(scope: cdk.Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const { sesARN, verificationUrl, recoveryUrl } = props;

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
    this.addTriggerCustomMessage(verificationUrl, recoveryUrl);

    /**
     * Use SES to send emails
     */
    this.setEmailConfiguration(sesARN);
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

  addTriggerCustomMessage(verificationUrl: string, recoveryUrl: string) {
    const cognitoCustomMessageFunction = new lambda.Function(this, 'cognitoCustomMessage', {
      functionName: 'cognito-customMessage',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../', 'functions', 'cognito', 'customMessage'),
      ),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment: {
        VERIFICATION_URL: verificationUrl,
        RECOVERY_URL: recoveryUrl,
      },
    });

    this.userPool.addTrigger(
      cognito.UserPoolOperation.CUSTOM_MESSAGE,
      cognitoCustomMessageFunction,
    );
  }

  setEmailConfiguration(sesArn: string) {
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.emailConfiguration = {
      emailSendingAccount: 'DEVELOPER',
      sourceArn: sesArn,
      from: 'Tifo <no-reply@tifo-sport.com>',
    };
  }
}
