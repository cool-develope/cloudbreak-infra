import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as cognito from '@aws-cdk/aws-cognito';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { Rule } from '@aws-cdk/aws-events';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import targets = require('@aws-cdk/aws-events-targets');

export interface EventsStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  mainTable: dynamodb.Table;
  imagesDomain: string;
  esDomain: string;
  commonModulesLayerArn: string;
}

export class EventsStack extends cdk.Stack {
  private readonly commonModulesLayer: lambda.ILayerVersion;
  private readonly userPool: cognito.UserPool;

  constructor(scope: cdk.Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    const { mainTable, imagesDomain, esDomain, commonModulesLayerArn, userPool } = props;

    this.userPool = userPool;

    this.commonModulesLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'api2-layers-common-modules',
      commonModulesLayerArn,
    );

    const createUserFunction = this.getFunction(
      'events-createUser',
      'events-createUser',
      'createUser',
      {
        MAIN_TABLE_NAME: mainTable.tableName,
      },
    );

    const notificationsFunction = this.getFunction(
      'events-notifications',
      'events-notifications',
      'notifications',
      {
        MAIN_TABLE_NAME: mainTable.tableName,
        IMAGES_DOMAIN: imagesDomain,
        ES_DOMAIN: esDomain,
      },
    );

    const teamFunction = this.getFunction('events-team', 'events-team', 'team', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
      ES_DOMAIN: esDomain,
      COGNITO_USERPOOL_ID: this.userPool.userPoolId,
    });

    mainTable.grantReadWriteData(createUserFunction);
    mainTable.grantReadWriteData(notificationsFunction);
    mainTable.grantReadWriteData(teamFunction);
    this.allowCognito(teamFunction);

    const rule = new Rule(this, 'CognitoSignupRule', {
      enabled: true,
      eventPattern: {
        source: ['custom.cognito'],
        detailType: ['signup'],
      },
    });

    const teamRule = new Rule(this, 'TeamRule', {
      enabled: true,
      eventPattern: {
        source: ['tifo.api'],
        detailType: ['SendTeamInvitation', 'DeclineTeamInvitation', 'AcceptTeamInvitation'],
      },
      targets: [new targets.LambdaFunction(teamFunction)],
    });

    const notificationsRule = new Rule(this, 'NotificationsRule', {
      enabled: true,
      eventPattern: {
        source: ['tifo.api', 'tifo.treezor'],
        // all detailType
      },
      targets: [new targets.LambdaFunction(notificationsFunction)],
    });

    rule.addTarget(new targets.LambdaFunction(createUserFunction));
  }

  allowCognito(fn: lambda.Function) {
    const cognitoPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    cognitoPolicy.addActions(
      'cognito-idp:AdminUpdateUserAttributes',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminRemoveUserFromGroup',
      'cognito-idp:AdminGetUser',
    );
    cognitoPolicy.addResources('*');
    fn.addToRolePolicy(cognitoPolicy);
  }

  getFunction(id: string, functionName: string, folderName: string, environment?: any) {
    return new lambda.Function(this, id, {
      functionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'events', folderName)),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment,
      logRetention: RetentionDays.THREE_DAYS,
      tracing: lambda.Tracing.ACTIVE,
      layers: [this.commonModulesLayer],
    });
  }
}
