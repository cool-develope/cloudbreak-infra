import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { Fn } from '@aws-cdk/core';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { Rule } from '@aws-cdk/aws-events';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import targets = require('@aws-cdk/aws-events-targets');

export interface EventsStackProps extends cdk.StackProps {
  imagesDomain: string;
  commonModulesLayerArn: string;
}

export class EventsStack extends cdk.Stack {
  private readonly commonModulesLayer: lambda.ILayerVersion;
  private readonly userPoolId: string;

  constructor(scope: cdk.Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    const { imagesDomain, commonModulesLayerArn } = props;
    const { MAIN_TABLE_NAME = '' } = process.env;

    const mainTable = dynamodb.Table.fromTableName(this, 'MTable', MAIN_TABLE_NAME);
    this.userPoolId = Fn.importValue('UserPoolId');
    const esDomain = `https://${Fn.importValue('EsDomainEndpoint')}`;

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
      COGNITO_USERPOOL_ID: this.userPoolId,
    });

    this.allowDynamoDB(createUserFunction);
    this.allowDynamoDB(notificationsFunction);
    this.allowDynamoDB(teamFunction);
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

  allowDynamoDB(lambdaFunction: lambda.Function) {
    const dbPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    dbPolicy.addActions(
      'dynamodb:BatchGetItem',
      'dynamodb:GetRecords',
      'dynamodb:GetShardIterator',
      'dynamodb:Query',
      'dynamodb:GetItem',
      'dynamodb:Scan',
      'dynamodb:BatchWriteItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem',
    );
    dbPolicy.addResources(
      'arn:aws:dynamodb:eu-central-1:596882852595:table/Tifo',
      'arn:aws:dynamodb:eu-central-1:596882852595:table/Tifo/index/*',
    );

    lambdaFunction.addToRolePolicy(dbPolicy);
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
