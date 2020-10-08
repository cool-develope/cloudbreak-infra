import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import { DynamoEventSource } from '@aws-cdk/aws-lambda-event-sources';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { Duration } from '@aws-cdk/core';

export interface TableStackProps extends cdk.StackProps {
  esDomain: string;
  dictionaryTableName: string;
  mainTableName: string;
}

export class TableStack extends cdk.Stack {
  public readonly dictionaryTable: dynamodb.Table;
  public readonly mainTable: dynamodb.Table;

  constructor(scope: cdk.Construct, id: string, props: TableStackProps) {
    super(scope, id, props);

    const { dictionaryTableName, mainTableName, esDomain } = props;

    /**
     * Dictionary
     */
    this.dictionaryTable = new dynamodb.Table(this, 'DictionaryTable', {
      tableName: dictionaryTableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    /**
     * Main
     */
    this.mainTable = new dynamodb.Table(this, 'MainTable', {
      tableName: mainTableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    this.mainTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
      readCapacity: 5,
      writeCapacity: 5,
    });

    const dynamoStreamMainFunction = this.getFunction(
      'events-dynamoStreamMain',
      'events-dynamoStreamMain',
      'dynamoStreamMain',
      {
        MAIN_TABLE_NAME: mainTableName,
        ES_DOMAIN: esDomain,
      },
    );

    this.mainTable.grantReadWriteData(dynamoStreamMainFunction);

    dynamoStreamMainFunction.addEventSource(
      new DynamoEventSource(this.mainTable, {
        batchSize: 100,
        maxBatchingWindow: Duration.seconds(0),
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      }),
    );

    const mainPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });

    mainPolicy.addActions(
      'es:ESHttpDelete',
      'es:ESHttpGet',
      'es:ESHttpHead',
      'es:ESHttpPost',
      'es:ESHttpPut',
      'es:ESHttpPatch',
    );
    mainPolicy.addResources('*');

    // Allow Lambda access VPC
    // ec2:CreateNetworkInterface
    // ec2:DescribeNetworkInterfaces
    // ec2:DeleteNetworkInterface

    dynamoStreamMainFunction.addToRolePolicy(mainPolicy);
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
      timeout: cdk.Duration.seconds(120),
      memorySize: 1024,
    });
  }
}
