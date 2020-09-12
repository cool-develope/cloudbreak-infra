import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import { ITable } from '@aws-cdk/aws-dynamodb';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';

export interface Api2StackProps extends cdk.StackProps {
  dictionaryTable: dynamodb.Table;
  mainTable: dynamodb.Table;
  imagesDomain: string;
  esDomain: string;
  api: appsync.GraphqlApi;
}

export class Api2Stack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi;
  public readonly dictionaryTable: dynamodb.Table;
  public readonly mainTable: dynamodb.Table;
  public readonly imagesDomain: string;
  public readonly esDomain: string;

  constructor(scope: cdk.Construct, id: string, props: Api2StackProps) {
    super(scope, id, props);

    const { dictionaryTable, mainTable, imagesDomain, esDomain, api } = props;

    this.api = api;
    this.dictionaryTable = dictionaryTable;
    this.mainTable = mainTable;
    this.imagesDomain = imagesDomain;
    this.esDomain = esDomain;

    /**
     * Query: countries, languages
     */
    this.dictionaryQuery();

    /**
     * Mutation: createTreezorUser
     */
    this.createTreezorUserMutation();
  }

  dictionaryQuery() {
    const dictionaryFunction = this.getFunction('dictionary', 'api-dictionary', 'dictionary');

    this.dictionaryTable.grantReadData(dictionaryFunction);

    const dictionaryDS = this.api.addLambdaDataSource('dictionaryFunction', dictionaryFunction);

    dictionaryDS.createResolver({
      typeName: 'Query',
      fieldName: 'countries',
    });

    dictionaryDS.createResolver({
      typeName: 'Query',
      fieldName: 'languages',
    });
  }

  createTreezorUserMutation() {
    const { TREEZOR_BASE_URL, TREEZOR_CLIENT_ID, TREEZOR_CLIENT_SECRET } = process.env;

    const createTreezorUserFunction = this.getFunction(
      'createTreezorUser',
      'api-createTreezorUser',
      'createTreezorUser',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        ES_DOMAIN: this.esDomain,
        TREEZOR_BASE_URL,
        TREEZOR_CLIENT_ID,
        TREEZOR_CLIENT_SECRET,
      },
    );

    this.mainTable.grantReadWriteData(createTreezorUserFunction);
    this.allowES(createTreezorUserFunction);

    const cognitoPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    cognitoPolicy.addActions('cognito-idp:AdminUpdateUserAttributes');
    cognitoPolicy.addResources('*');
    createTreezorUserFunction.addToRolePolicy(cognitoPolicy);

    const dataSource = this.api.addLambdaDataSource(
      'createTreezorUserFunction',
      createTreezorUserFunction,
    );

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'createTreezorUser',
    });
  }

  allowES(lambdaFunction: lambda.Function) {
    const esPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });

    esPolicy.addActions('es:ESHttpGet', 'es:ESHttpHead');
    esPolicy.addResources('*');

    lambdaFunction.addToRolePolicy(esPolicy);
  }

  getFunction(
    id: string,
    functionName: string,
    folderName: string,
    environment?: any,
    timeoutSeconds = 30,
    memorySize = 128,
  ) {
    return new lambda.Function(this, id, {
      functionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'api', folderName)),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment,
      logRetention: RetentionDays.THREE_DAYS,
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(timeoutSeconds),
      memorySize,
    });
  }
}
