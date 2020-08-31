import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { Rule } from '@aws-cdk/aws-events';
import targets = require('@aws-cdk/aws-events-targets');
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';

export interface EventsStackProps extends cdk.StackProps {
  mainTableName: string;
}

export class EventsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    const { TREEZOR_BASE_URL, TREEZOR_CLIENT_ID, TREEZOR_CLIENT_SECRET } = process.env;
    const { mainTableName } = props;

    const mainTable = dynamodb.Table.fromTableName(this, 'events-table-main', mainTableName);

    // const createTreezorUserFunction = this.getFunction(
    //   'events-createTreezorUser',
    //   'events-createTreezorUser',
    //   'createTreezorUser',
    //   {
    //     TREEZOR_BASE_URL,
    //     TREEZOR_CLIENT_ID,
    //     TREEZOR_CLIENT_SECRET,
    //   },
    // );

    const createUserFunction = this.getFunction(
      'events-createUser',
      'events-createUser',
      'createUser',
      {
        MAIN_TABLE_NAME: mainTableName
      },
    );

    mainTable.grantReadWriteData(createUserFunction);

    // const cognitoPolicy = new PolicyStatement({
    //   effect: Effect.ALLOW,
    // });
    // cognitoPolicy.addActions('cognito-idp:AdminUpdateUserAttributes');
    // cognitoPolicy.addResources('*');
    // createTreezorUserFunction.addToRolePolicy(cognitoPolicy);

    const rule = new Rule(this, 'CognitoSignupRule', {
      enabled: true,
      eventPattern: {
        source: ['custom.cognito'],
        detailType: ['signup'],
      },
    });

    // rule.addTarget(new targets.LambdaFunction(createTreezorUserFunction));
    rule.addTarget(new targets.LambdaFunction(createUserFunction));
  }

  getFunction(id: string, functionName: string, folderName: string, environment?: any) {
    return new lambda.Function(this, id, {
      functionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'events', folderName)),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment,
      logRetention: RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    });
  }
}
