import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';
import { ITable } from '@aws-cdk/aws-dynamodb';
import { UserPoolDefaultAction, MappingTemplate } from '@aws-cdk/aws-appsync';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';

const SCHEMA_FILE = '../schema.graphql';

export interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  dictionaryTableName: string;
  mainTableName: string;
  imagesDomain: string;
  esDomain: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: appsync.GraphQLApi;

  constructor(scope: cdk.Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { userPool, dictionaryTableName, mainTableName, imagesDomain, esDomain } = props;

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
    this.feedQuery(mainTable, imagesDomain, esDomain);

    /**
     * Mutation: syncContacts
     * Query: contacts
     */
    this.syncContactsMutation(mainTable);

    /**
     * Mutation: addLike, removeLike, acceptEvent, declineEvent
     */
    this.addLikeMutation(mainTable);

    /**
     * Field: Event.author
     */
    this.eventAuthorField(mainTable);

    /**
     * Query: myEvents
     */
    this.myEventsQuery(mainTable, imagesDomain, esDomain);

    /**
     * Query: upcomingEventsPrivate
     */
    this.upcomingEventsPrivateQuery(mainTable, imagesDomain, esDomain);

    /**
     * Query: teamsPrivate
     */
    this.teamsPrivateQuery(mainTable, imagesDomain, esDomain);

    /**
     * Query: clubsPrivate
     */
    this.clubsPrivateQuery(mainTable, imagesDomain, esDomain);

    /**
     * Query: federationsPrivate
     */
    this.federationsPrivateQuery(mainTable, imagesDomain, esDomain);

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
    const { IMAGES_BUCKET_NAME } = process.env;

    const createEventFunction = this.getFunction('createEvent', 'api-createEvent', 'createEvent', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
      IMAGES_BUCKET: IMAGES_BUCKET_NAME,
    }, 30, 256);

    mainTable.grantReadWriteData(createEventFunction);

    const s3Policy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    s3Policy.addActions('s3:GetObject');
    s3Policy.addResources(`arn:aws:s3:::${IMAGES_BUCKET_NAME}/*`);

    createEventFunction.addToRolePolicy(s3Policy);

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

  feedQuery(mainTable: ITable, imagesDomain: string, esDomain: string) {
    const feedFunction = this.getFunction('feed', 'api-feed', 'feed', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
      ES_DOMAIN: esDomain,
    });

    mainTable.grantReadWriteData(feedFunction);
    this.allowES(feedFunction);

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
    }, 120, 256);

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

  eventAuthorField(mainTable: ITable) {
    const eventAuthorBatchFunction = this.getFunction('eventAuthorBatch', 'api-eventAuthorBatch', 'eventAuthorBatch', {
      MAIN_TABLE_NAME: mainTable.tableName
    }, 120 );

    mainTable.grantReadWriteData(eventAuthorBatchFunction);

    const lambdaDS = this.api.addLambdaDataSource('eventAuthorBatchFunction', eventAuthorBatchFunction);

    lambdaDS.createResolver({
      typeName: 'Event',
      fieldName: 'author',
      requestMappingTemplate: MappingTemplate.fromString(`
{
  "version" : "2017-02-28",
  "operation": "BatchInvoke",
  "payload": $utils.toJson($context.source)
}
`),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    lambdaDS.createResolver({
      typeName: 'Post',
      fieldName: 'author',
      requestMappingTemplate: MappingTemplate.fromString(`
{
  "version" : "2017-02-28",
  "operation": "BatchInvoke",
  "payload": $utils.toJson($context.source)
}
`),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });
  }

  myEventsQuery(mainTable: ITable, imagesDomain: string, esDomain: string) {
    const myEventsFunction = this.getFunction('myEvents', 'api-myEvents', 'myEvents', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
      ES_DOMAIN: esDomain,
    });

    mainTable.grantReadWriteData(myEventsFunction);
    this.allowES(myEventsFunction);

    const dataSource = this.api.addLambdaDataSource('myEventsFunction', myEventsFunction);

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'myEvents',
    });
  }

  upcomingEventsPrivateQuery(mainTable: ITable, imagesDomain: string, esDomain: string) {
    const upcomingEventsPrivateFunction = this.getFunction('upcomingEventsPrivate', 'api-upcomingEventsPrivate', 'upcomingEventsPrivate', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
      ES_DOMAIN: esDomain,
    });

    mainTable.grantReadWriteData(upcomingEventsPrivateFunction);
    this.allowES(upcomingEventsPrivateFunction);

    const dataSource = this.api.addLambdaDataSource('upcomingEventsPrivateFunction', upcomingEventsPrivateFunction);

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'upcomingEventsPrivate',
    });
  }

  teamsPrivateQuery(mainTable: ITable, imagesDomain: string, esDomain: string) {
    const teamsPrivateFunction = this.getFunction('teamsPrivate', 'api-teamsPrivate', 'teamsPrivate', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
      ES_DOMAIN: esDomain,
    });

    mainTable.grantReadWriteData(teamsPrivateFunction);
    this.allowES(teamsPrivateFunction);

    const dataSource = this.api.addLambdaDataSource('teamsPrivateFunction', teamsPrivateFunction);

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'teamsPrivate',
    });
  }

  clubsPrivateQuery(mainTable: ITable, imagesDomain: string, esDomain: string) {
    const clubsPrivateFunction = this.getFunction('clubsPrivate', 'api-clubsPrivate', 'clubsPrivate', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
      ES_DOMAIN: esDomain,
    });

    mainTable.grantReadWriteData(clubsPrivateFunction);
    this.allowES(clubsPrivateFunction);

    const dataSource = this.api.addLambdaDataSource('clubsPrivateFunction', clubsPrivateFunction);

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'clubsPrivate',
    });
  }

  federationsPrivateQuery(mainTable: ITable, imagesDomain: string, esDomain: string) {
    const federationsPrivateFunction = this.getFunction('federationsPrivate', 'api-federationsPrivate', 'federationsPrivate', {
      MAIN_TABLE_NAME: mainTable.tableName,
      IMAGES_DOMAIN: imagesDomain,
      ES_DOMAIN: esDomain,
    });

    mainTable.grantReadWriteData(federationsPrivateFunction);
    this.allowES(federationsPrivateFunction);

    const dataSource = this.api.addLambdaDataSource('federationsPrivateFunction', federationsPrivateFunction);

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'federationsPrivate',
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

  getApiKeyExpiration(): string {
    const date = new Date(2021, 6, 1)
    return date.toISOString();
  }

  getFunction(id: string, functionName: string, folderName: string, environment?: any, timeoutSeconds = 30, memorySize = 128) {
    return new lambda.Function(this, id, {
      functionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'api', folderName)),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment,
      logRetention: RetentionDays.THREE_DAYS,
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(timeoutSeconds),
      memorySize
    });
  }
}
