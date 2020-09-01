import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';
import { ITable } from '@aws-cdk/aws-dynamodb';
import { UserPoolDefaultAction } from '@aws-cdk/aws-appsync';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';

const SCHEMA_FILE = '../schema.graphql';

export interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  dictionaryTableName: string;
  mainTableName: string;
  imagesDomain: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: appsync.GraphQLApi;

  constructor(scope: cdk.Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { userPool, dictionaryTableName, mainTableName, imagesDomain } = props;

    const dictionaryTable = dynamodb.Table.fromTableName(
      this,
      'table-dictionary',
      dictionaryTableName,
    );

    const mainTable = dynamodb.Table.fromTableName(this, 'table-main', mainTableName);

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
              expires: this.getApiKeyExpiration(),
            },
          },
        ],
      },
      schema: appsync.Schema.fromAsset(path.join(__dirname, SCHEMA_FILE)),
      xrayEnabled: true,
    });

    /**
     * Query: countries, languages
     */
    this.dictionaryQuery(dictionaryTable);

    /**
     * Mutation: signinMobile, signoutMobile
     */
    this.signinMobileMutation(mainTable);

    /**
     * Mutation: updateUser
     */
    this.updateUserMutation(mainTable, imagesDomain);

    /**
     * Query: uploadUrl
     */
    this.uploadUrlQuery();

    /**
     * Mutation: createEvent, createPost
     */
    this.createEventMutation(mainTable, imagesDomain);

    /**
     * Query: feed, feedPrivate
     */
    this.feedQuery(mainTable, imagesDomain);

    /**
     * Mutation: syncContacts
     * Query: contacts
     */
    this.syncContactsMutation(mainTable);

    /**
     * Mutation: addLike, removeLike, acceptEvent, declineEvent
     */
    this.addLikeMutation(mainTable);

    new cdk.CfnOutput(this, 'api-url', { value: this.api.graphQlUrl });
  }

  dictionaryQuery(dictionaryTable: ITable) {
    const dictionaryFunction = this.getFunction('dictionary', 'api-dictionary', 'dictionary');

    dictionaryTable.grantReadData(dictionaryFunction);

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

  uploadUrlQuery() {
    const { IMAGES_BUCKET_NAME } = process.env;

    const lambdaFunction = this.getFunction('uploadUrl', 'api-uploadUrl', 'uploadUrl', {
      IMAGES_BUCKET: IMAGES_BUCKET_NAME,
    });

    const s3Policy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    s3Policy.addActions('s3:PutObject');
    s3Policy.addResources(`arn:aws:s3:::${IMAGES_BUCKET_NAME}/*`);

    lambdaFunction.addToRolePolicy(s3Policy);

    const lambdaDS = this.api.addLambdaDataSource('uploadUrlFunction', lambdaFunction);

    lambdaDS.createResolver({
      typeName: 'Query',
      fieldName: 'uploadUrl',
    });
  }

  signinMobileMutation(mainTable: ITable) {
    const signinMobileFunction = this.getFunction(
      'signinMobile',
      'api-signinMobile',
      'signinMobile',
      {
        MAIN_TABLE_NAME: mainTable.tableName,
      },
    );

    mainTable.grantReadWriteData(signinMobileFunction);

    const dataSource = this.api.addLambdaDataSource('signinMobileFunction', signinMobileFunction);

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'signinMobile',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'signoutMobile',
    });
  }

  updateUserMutation(mainTable: ITable, imagesDomain: string) {
    const updateUserFunction = this.getFunction('updateUser', 'api-updateUser', 'updateUser', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
      ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID,
      ONESIGNAL_API_KEY: process.env.ONESIGNAL_API_KEY,
    });

    mainTable.grantReadWriteData(updateUserFunction);

    const dataSource = this.api.addLambdaDataSource('updateUserFunction', updateUserFunction);

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'updateUser',
    });

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'me',
    });
  }

  createEventMutation(mainTable: ITable, imagesDomain: string) {
    const createEventFunction = this.getFunction('createEvent', 'api-createEvent', 'createEvent', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
    });

    mainTable.grantReadWriteData(createEventFunction);

    const dataSource = this.api.addLambdaDataSource('createEventFunction', createEventFunction);

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'createEvent',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'createPost',
    });
  }

  feedQuery(mainTable: ITable, imagesDomain: string) {
    const feedFunction = this.getFunction('feed', 'api-feed', 'feed', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
    });

    mainTable.grantReadWriteData(feedFunction);

    const dataSource = this.api.addLambdaDataSource('feedFunction', feedFunction);

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'feed',
    });

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'feedPrivate',
    });
  }

  syncContactsMutation(mainTable: ITable) {
    const lambdaFunction = this.getFunction('syncContacts', 'api-syncContacts', 'syncContacts', {
      MAIN_TABLE_NAME: mainTable.tableName
    }, 120 );

    mainTable.grantReadWriteData(lambdaFunction);

    const lambdaDS = this.api.addLambdaDataSource('syncContactsFunction', lambdaFunction);

    lambdaDS.createResolver({
      typeName: 'Mutation',
      fieldName: 'syncContacts',
    });

    lambdaDS.createResolver({
      typeName: 'Query',
      fieldName: 'contacts',
    });
  }

  addLikeMutation(mainTable: ITable) {
    const lambdaFunction = this.getFunction('addLike', 'api-addLike', 'addLike', {
      MAIN_TABLE_NAME: mainTable.tableName
    }, 120 );

    mainTable.grantReadWriteData(lambdaFunction);

    const lambdaDS = this.api.addLambdaDataSource('addLikeFunction', lambdaFunction);

    lambdaDS.createResolver({
      typeName: 'Mutation',
      fieldName: 'addLike',
    });

    lambdaDS.createResolver({
      typeName: 'Mutation',
      fieldName: 'removeLike',
    });

    lambdaDS.createResolver({
      typeName: 'Mutation',
      fieldName: 'acceptEvent',
    });

    lambdaDS.createResolver({
      typeName: 'Mutation',
      fieldName: 'declineEvent',
    });
  }

  getApiKeyExpiration(): string {
    const date = new Date(2021, 6, 1)
    return date.toISOString();
  }

  getFunction(id: string, functionName: string, folderName: string, environment?: any, timeoutSeconds = 30) {
    return new lambda.Function(this, id, {
      functionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'api', folderName)),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment,
      logRetention: RetentionDays.THREE_DAYS,
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(timeoutSeconds),
    });
  }
}
