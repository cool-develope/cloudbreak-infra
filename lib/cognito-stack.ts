import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { Fn } from '@aws-cdk/core';
import { UserPoolOperation, CfnUserPoolClient } from '@aws-cdk/aws-cognito';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';

export interface CognitoStackProps extends cdk.StackProps {
  signinUrl: string;
  signinWebUrl: string;
  mainTableName: string;
  imagesDomain: string;
}

export class CognitoStack extends cdk.Stack {
  private readonly userPool: cognito.UserPool;

  constructor(scope: cdk.Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const { signinUrl, signinWebUrl, mainTableName, imagesDomain } = props;
    const mainTable = dynamodb.Table.fromTableName(this, 'events-table-main', mainTableName);

    const customAttributes = {
      clubs: new cognito.StringAttribute({ maxLen: 2048, mutable: true }),
      teams: new cognito.StringAttribute({ maxLen: 2048, mutable: true }),
      federations: new cognito.StringAttribute({ maxLen: 2048, mutable: true }),
      trzUserId: new cognito.StringAttribute({ maxLen: 1000, mutable: true }),
      trzScopes: new cognito.StringAttribute({ maxLen: 1000, mutable: true }),
      trzChildren: new cognito.StringAttribute({
        maxLen: 2048,
        mutable: true,
      }),
      trzWalletsId: new cognito.StringAttribute({ maxLen: 2048, mutable: true }),
      trzCardsId: new cognito.StringAttribute({ maxLen: 2048, mutable: true }),
    };

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

    new cognito.CfnUserPoolGroup(this, 'club-owners-group', {
      groupName: 'club-owners',
      userPoolId: this.userPool.userPoolId,
    });

    new cognito.CfnUserPoolGroup(this, 'club-coaches-group', {
      groupName: 'club-coaches',
      userPoolId: this.userPool.userPoolId,
    });

    new cognito.CfnUserPoolGroup(this, 'federation-owners-group', {
      groupName: 'federation-owners',
      userPoolId: this.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: 'UserPoolId',
    });

    this.createUserPoolWebClient();
    this.createUserPoolMobileClient();

    /**
     * Add triggers
     */
    this.addTriggerCreateAuthChallenge(signinUrl, signinWebUrl, imagesDomain);
    this.addTriggerDefineAuthChallenge();
    this.addTriggerPreSignup();
    this.addTriggerVerifyAuthChallenge();
    this.addTriggerPostAuthentication(mainTable);
  }

  createUserPoolWebClient() {
    const userPoolClient = new CfnUserPoolClient(this, 'UserPoolWebClient', {
      userPoolId: this.userPool.userPoolId,
      clientName: 'web-client',
      explicitAuthFlows: ['ALLOW_CUSTOM_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      readAttributes: [
        'email',
        'custom:clubs',
        'custom:teams',
        'custom:federations',
        'custom:trzUserId',
        'custom:trzScopes',
        'custom:trzChildren',
        'custom:trzWalletsId',
        'custom:trzCardsId',
      ],
      writeAttributes: ['address'],
    });

    new cdk.CfnOutput(this, 'UserPoolWebClientId', {
      value: userPoolClient.ref,
      exportName: 'UserPoolWebClientId',
    });
  }

  createUserPoolMobileClient() {
    const userPoolClient = new CfnUserPoolClient(this, 'UserPoolMobileClient', {
      userPoolId: this.userPool.userPoolId,
      clientName: 'mobile-client',
      explicitAuthFlows: ['ALLOW_CUSTOM_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      readAttributes: [
        'email',
        'custom:clubs',
        'custom:teams',
        'custom:federations',
        'custom:trzUserId',
        'custom:trzScopes',
        'custom:trzChildren',
        'custom:trzWalletsId',
        'custom:trzCardsId',
      ],
      writeAttributes: ['address'],
    });

    new cdk.CfnOutput(this, 'UserPoolMobileClientId', {
      value: userPoolClient.ref,
      exportName: 'UserPoolMobileClientId',
    });
  }

  addTriggerCreateAuthChallenge(signinUrl: string, signinWebUrl: string, imagesDomain: string) {
    const webClientId = Fn.importValue('UserPoolWebClientId');
    const mobileClientId = Fn.importValue('UserPoolMobileClientId');

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
        COGNITO_WEB_CLIENT_ID: webClientId,
        COGNITO_MOBILE_CLIENT_ID: mobileClientId,
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
