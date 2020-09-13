import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { Rule } from '@aws-cdk/aws-events';
import targets = require('@aws-cdk/aws-events-targets');

export interface EventsStackProps extends cdk.StackProps {
  mainTable: dynamodb.Table;
}

export class EventsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    const { mainTable } = props;

    const createUserFunction = this.getFunction(
      'events-createUser',
      'events-createUser',
      'createUser',
      {
        MAIN_TABLE_NAME: mainTable.tableName,
      },
    );

    mainTable.grantReadWriteData(createUserFunction);

    const rule = new Rule(this, 'CognitoSignupRule', {
      enabled: true,
      eventPattern: {
        source: ['custom.cognito'],
        detailType: ['signup'],
      },
    });

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
