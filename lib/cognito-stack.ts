import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { UserPoolOperation } from '@aws-cdk/aws-cognito';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';

export interface CognitoStackProps extends cdk.StackProps {
  signinUrl: string;
  signinWebUrl: string;
  mainTableName: string;
  imagesDomain: string;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;

  constructor(scope: cdk.Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const { signinUrl, signinWebUrl, mainTableName, imagesDomain } = props;
    const mainTable = dynamodb.Table.fromTableName(this, 'events-table-main', mainTableName);

    /**
     * TODO: Fix it some time
     */
    let customAttributes = null;
    if (process.env.TIFO_ENV === 'dev') {
      /**
       * Old dev deploy
       */
      customAttributes = {
        trzUserId: new cognito.StringAttribute({ minLen: 1, maxLen: 256, mutable: true }),
        trzScopes: new cognito.StringAttribute({ minLen: 1, maxLen: 256, mutable: true }),
        trzChildren: new cognito.StringAttribute({
          maxLen: 1000,
          mutable: true,
        }),
        trzWalletsId: new cognito.StringAttribute({ maxLen: 1000, mutable: true }),
        trzCardsId: new cognito.StringAttribute({ maxLen: 1000, mutable: true }),
      };
    } else if (process.env.TIFO_ENV === 'test') {
      /**
       * TEST env
       */
      customAttributes = {
        trzUserId: new cognito.StringAttribute({ maxLen: 1000, mutable: true }),
        trzScopes: new cognito.StringAttribute({ maxLen: 1000, mutable: true }),
        trzChildren: new cognito.StringAttribute({
          maxLen: 1000,
          mutable: true,
        }),
        trzWalletsId: new cognito.StringAttribute({ maxLen: 1000, mutable: true }),
        trzCardsId: new cognito.StringAttribute({ maxLen: 1000, mutable: true }),
      };
    } else {
      /**
       * New deploy
       */
      customAttributes = {
        trzUserId: new cognito.StringAttribute({ minLen: 1, maxLen: 1000, mutable: true }),
        trzScopes: new cognito.StringAttribute({ minLen: 1, maxLen: 1000, mutable: true }),
        trzChildren: new cognito.StringAttribute({
          maxLen: 1000,
          mutable: true,
        }),
        trzWalletsId: new cognito.StringAttribute({ maxLen: 1000, mutable: true }),
        trzCardsId: new cognito.StringAttribute({ maxLen: 1000, mutable: true }),
      };
    }

    this.userPool = new cognito.UserPool(this, 'user-pool', {
      userPoolName: 'users',
      selfSignUpEnabled: true,
      signInCaseSensitive: false,
      signInAliases: {
        username: false,
        email: true,
      },
      autoVerify: { email: true },
      customAttributes,
    });

    new cdk.CfnOutput(this, 'user-pool-id', { value: this.userPool.userPoolId });

    /**
     * Create a UserPool client for web/mobile app
     */
    const userPoolClient = this.createUserPoolClient();

    /**
     * Add triggers
     */
    this.addTriggerCreateAuthChallenge(signinUrl, signinWebUrl, imagesDomain);
    this.addTriggerDefineAuthChallenge();
    this.addTriggerPreSignup();
    this.addTriggerVerifyAuthChallenge();
    this.addTriggerPostAuthentication(mainTable);
  }

  createUserPoolClient() {
    const userPoolClient = new cognito.UserPoolClient(this, 'user-pool-web-client', {
      userPool: this.userPool,
      userPoolClientName: 'web-client',
      authFlows: {
        custom: true,
        refreshToken: true,
        userSrp: true,
      },
    });

    new cdk.CfnOutput(this, 'user-pool-web-client-id', { value: userPoolClient.userPoolClientId });
    return userPoolClient;
  }

  addTriggerCreateAuthChallenge(signinUrl: string, signinWebUrl: string, imagesDomain: string) {
    const triggerFunction = this.getFunction(
      'cognitoCreateAuthChallenge',
      'cognito-createAuthChallenge',
      'createAuthChallenge',
      {
        SES_FROM_ADDRESS: 'no-reply@tifo-sport.com',
        SES_REGION: 'eu-west-1',
        SIGNIN_URL: signinUrl,
        SIGNIN_WEB_URL: signinWebUrl,
        IMAGES_DOMAIN: imagesDomain,
      },
    );

    const sesPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    sesPolicy.addActions('ses:SendEmail');
    sesPolicy.addResources('*');

    triggerFunction.addToRolePolicy(sesPolicy);

    this.userPool.addTrigger(UserPoolOperation.CREATE_AUTH_CHALLENGE, triggerFunction);
  }

  addTriggerDefineAuthChallenge() {
    const triggerFunction = this.getFunction(
      'cognito-defineAuthChallenge',
      'cognito-defineAuthChallenge',
      'defineAuthChallenge',
    );

    this.userPool.addTrigger(UserPoolOperation.DEFINE_AUTH_CHALLENGE, triggerFunction);
  }

  addTriggerPreSignup() {
    const triggerFunction = this.getFunction('cognito-preSignup', 'cognito-preSignup', 'preSignup');

    this.userPool.addTrigger(UserPoolOperation.PRE_SIGN_UP, triggerFunction);
  }

  addTriggerVerifyAuthChallenge() {
    const triggerFunction = this.getFunction(
      'cognito-verifyAuthChallenge',
      'cognito-verifyAuthChallenge',
      'verifyAuthChallenge',
    );

    this.userPool.addTrigger(UserPoolOperation.VERIFY_AUTH_CHALLENGE_RESPONSE, triggerFunction);
  }

  addTriggerPostAuthentication(mainTable: dynamodb.ITable) {
    const triggerFunction = this.getFunction(
      'cognito-postAuthentication',
      'cognito-postAuthentication',
      'postAuthentication',
      {
        MAIN_TABLE_NAME: mainTable.tableName,
      },
    );

    const eventsPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    eventsPolicy.addActions('events:PutEvents');
    eventsPolicy.addResources('*');

    triggerFunction.addToRolePolicy(eventsPolicy);
    mainTable.grantReadData(triggerFunction);

    this.userPool.addTrigger(UserPoolOperation.POST_AUTHENTICATION, triggerFunction);
  }

  /**
   * Not used right now
   */
  setEmailConfiguration(sesArn: string) {
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.emailConfiguration = {
      emailSendingAccount: 'DEVELOPER',
      sourceArn: sesArn,
      from: 'Tifo <no-reply@tifo-sport.com>',
    };
  }

  getFunction(id: string, functionName: string, folderName: string, environment?: any) {
    return new lambda.Function(this, id, {
      functionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'cognito', folderName)),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment,
      logRetention: RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    });
  }
}
