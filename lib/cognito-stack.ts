import * as cdk from '@aws-cdk/core';
import * as cognito from "@aws-cdk/aws-cognito";

export class CognitoStack extends cdk.Stack {
  userPool: cognito.UserPool;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'user-pool', {
      userPoolName: 'users',
      selfSignUpEnabled: true,
      signInCaseSensitive: false,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.LINK
      },
      userInvitation: {
        emailSubject: 'Invite to join our awesome app!',
        emailBody: 'Hello {username}, you have been invited to join our awesome app! Your temporary password is {####}',
      },
      signInAliases: {
        //Whether user is allowed to sign up or sign in with a username
        username: false,

        //Whether a user is allowed to sign up or sign in with an email address
        email: true
      },
      autoVerify: { email: true },
    });

    new cdk.CfnOutput(this, 'user-pool-id', { value: this.userPool.userPoolId });

    /**
     * Create a WebClient for web app
     */
    this.createWebClient();
  }

  createWebClient() {
    const webClient = new cognito.UserPoolClient(this, 'user-pool-web-client', {
      userPool: this.userPool,
      userPoolClientName: 'web-client',
      // @ts-ignore
      enabledAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH', 'ALLOW_CUSTOM_AUTH', 'ALLOW_USER_SRP_AUTH']
    });

    new cdk.CfnOutput(this, 'user-pool-web-client-id', { value: webClient.userPoolClientId });
  }
};