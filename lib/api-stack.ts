import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';
import { ITable } from '@aws-cdk/aws-dynamodb';
import { UserPoolDefaultAction } from '@aws-cdk/aws-appsync';
import { RetentionDays } from '@aws-cdk/aws-logs';

const SCHEMA_FILE = './schema.graphql';

export interface ApiStackProps extends cdk.StackProps {
  userPoolId: string;
  dictionaryTableName: string;
  usersTableName: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: appsync.GraphQLApi;

  constructor(scope: cdk.Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { userPoolId, dictionaryTableName, usersTableName } = props;
    const userPool = cognito.UserPool.fromUserPoolId(this, 'user-pool', userPoolId);

    const dictionaryTable = dynamodb.Table.fromTableName(
      this,
      'table-dictionary',
      dictionaryTableName,
    );

    const usersTable = dynamodb.Table.fromTableName(this, 'table-users', usersTableName);

    /**
     * AppSync API
     */
    this.api = new appsync.GraphQLApi(this, 'api-appsync', {
      name: `tifo-api`,
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool,
            defaultAction: UserPoolDefaultAction.ALLOW,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: {
              name: 'test-public-key',
              description: 'Public API_KEY for testing',
              expires: this.getApiKeyExpiration(320),
            },
          },
        ],
      },
      schemaDefinition: appsync.SchemaDefinition.FILE,
      schemaDefinitionFile: SCHEMA_FILE,
    });

    /**
     * Query: countries, languages
     */
    this.dictionaryQuery(dictionaryTable);

    /**
     * Mutation: signinMobile, signoutMobile
     */
    this.signinMobileMutation(usersTable);

    /**
     * Mutation: updateUser
     */
    this.updateUserMutation(usersTable);

    new cdk.CfnOutput(this, 'api-url', { value: this.api.graphQlUrl });
  }

  dictionaryQuery(dictionaryTable: ITable) {
    const dictionaryFunction = this.getFunction('dictionary', 'api-dictionary', 'dictionary');

    dictionaryTable.grantReadData(dictionaryFunction);

    const dictionaryDS = this.api.addLambdaDataSource('dictionaryFunction', '', dictionaryFunction);

    dictionaryDS.createResolver({
      typeName: 'Query',
      fieldName: 'countries',
    });

    dictionaryDS.createResolver({
      typeName: 'Query',
      fieldName: 'languages',
    });
  }

  signinMobileMutation(usersTable: ITable) {
    const signinMobileFunction = this.getFunction(
      'signinMobile',
      'api-signinMobile',
      'signinMobile',
      {
        USERS_TABLE_NAME: usersTable.tableName,
      },
    );

    usersTable.grantReadWriteData(signinMobileFunction);

    const dataSource = this.api.addLambdaDataSource(
      'signinMobileFunction',
      '',
      signinMobileFunction,
    );

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'signinMobile',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'signoutMobile',
    });
  }

  updateUserMutation(usersTable: ITable) {
    const updateUserFunction = this.getFunction('updateUser', 'api-updateUser', 'updateUser', {
      USERS_TABLE_NAME: usersTable.tableName,
    });

    usersTable.grantReadWriteData(updateUserFunction);

    const dataSource = this.api.addLambdaDataSource('updateUserFunction', '', updateUserFunction);

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'updateUser',
    });
  }

  getApiKeyExpiration(days: number): string {
    const dateNow = new Date();
    dateNow.setDate(dateNow.getDate() + days);
    return dateNow.toISOString();
  }

  getFunction(id: string, functionName: string, folderName: string, environment?: any) {
    return new lambda.Function(this, id, {
      functionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'api', folderName)),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment,
      logRetention: RetentionDays.TWO_WEEKS,
      tracing: lambda.Tracing.ACTIVE,
    });
  }
}
