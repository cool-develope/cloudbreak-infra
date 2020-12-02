import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';
import { Fn } from '@aws-cdk/core';
import { UserPoolDefaultAction, MappingTemplate } from '@aws-cdk/aws-appsync';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { Duration } from '@aws-cdk/core';

const SCHEMA_FILE = '../schema.graphql';

export interface ApiStackProps extends cdk.StackProps {
  imagesDomain: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi;
  public readonly dictionaryTable: dynamodb.ITable;
  public readonly mainTable: dynamodb.ITable;
  public readonly imagesDomain: string;
  public readonly esDomain: string;

  constructor(scope: cdk.Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { imagesDomain } = props;
    const { MAIN_TABLE_NAME = '', DICTIONARY_TABLE_NAME = '' } = process.env;

    this.mainTable = dynamodb.Table.fromTableName(this, 'MTable', MAIN_TABLE_NAME);
    this.dictionaryTable = dynamodb.Table.fromTableName(this, 'DTable', DICTIONARY_TABLE_NAME);
    this.imagesDomain = imagesDomain;
    this.esDomain = `https://${Fn.importValue('EsDomainEndpoint')}`;

    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      'apiStackUserPool',
      Fn.importValue('UserPoolId'),
    );

    /**
     * AppSync API
     */
    this.api = new appsync.GraphqlApi(this, 'api-appsync', {
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
     * Mutation: signinMobile, signoutMobile
     */
    this.signinMobileMutation();

    /**
     * Mutation: updateUser
     */
    this.updateUserMutation();

    /**
     * Query: uploadUrl
     */
    this.uploadUrlQuery();

    /**
     * Mutation: createEvent, createPost, updateEvent, updatePost
     */
    this.createEventMutation();

    /**
     * Query: feed, feedPrivate, myEvents, upcomingEventsPrivate
     */
    this.feedQuery();

    /**
     * Mutation: syncContacts
     * Query: contacts
     */
    this.syncContactsMutation();

    /**
     * Mutation: addLike, removeLike, acceptEvent, declineEvent
     */
    this.addLikeMutation();

    /**
     * Field: Event.author
     */
    this.eventAuthorField();

    /**
     * Field: Event.myReaction
     */
    this.eventMyReactionField();

    /**
     * Field: Event.participants
     */
    this.eventParticipantsField();

    /**
     * Query: event, post, eventPrivate, postPrivate
     */
    this.eventQuery();

    /**
     * Mutation: inviteParent
     */
    this.inviteParentMutation();

    /**
     * Mutation: acceptChildInvitation, declineChildInvitation
     */
    this.acceptChildInvitationMutation();

    /**
     * Mutation: verifyPhone, sendPhoneVerification
     */
    this.verifyPhoneMutation();

    new cdk.CfnOutput(this, 'AppSyncUrl', {
      value: this.api.graphqlUrl,
      exportName: 'AppSyncUrl',
    });

    new cdk.CfnOutput(this, 'AppSyncApiId', {
      value: this.api.apiId,
      exportName: 'AppSyncApiId',
    });
  }

  uploadUrlQuery() {
    const { IMAGES_BUCKET_NAME, DOCS_BUCKET_NAME } = process.env;

    const lambdaFunction = this.getFunction('uploadUrl', 'api-uploadUrl', 'uploadUrl', {
      IMAGES_BUCKET_NAME,
      DOCS_BUCKET_NAME,
    });

    const s3Policy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    s3Policy.addActions('s3:PutObject');
    s3Policy.addResources(`arn:aws:s3:::${IMAGES_BUCKET_NAME}/*`);
    s3Policy.addResources(`arn:aws:s3:::${DOCS_BUCKET_NAME}/*`);

    lambdaFunction.addToRolePolicy(s3Policy);

    const kmsPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    kmsPolicy.addActions('kms:GenerateDataKey');
    kmsPolicy.addResources('*');
    lambdaFunction.addToRolePolicy(kmsPolicy);

    const lambdaDS = this.api.addLambdaDataSource('uploadUrlFunction', lambdaFunction);

    lambdaDS.createResolver({
      typeName: 'Query',
      fieldName: 'uploadUrl',
    });
  }

  signinMobileMutation() {
    const signinMobileFunction = this.getFunction(
      'signinMobile',
      'api-signinMobile',
      'signinMobile',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
      },
    );

    this.allowDynamoDB(signinMobileFunction);

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

  updateUserMutation() {
    const updateUserFunction = this.getFunction(
      'updateUser',
      'api-updateUser',
      'updateUser',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
      },
      30,
      256,
    );

    this.allowDynamoDB(updateUserFunction);

    const dataSource = this.api.addLambdaDataSource('updateUserFunction', updateUserFunction);

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'updateUser',
    });

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'me',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'setPin',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'verifyPin',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'changePin',
    });
  }

  createEventMutation() {
    const { IMAGES_BUCKET_NAME } = process.env;

    const createEventFunction = this.getFunction(
      'createEvent',
      'api-createEvent',
      'createEvent',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        IMAGES_BUCKET: IMAGES_BUCKET_NAME,
      },
      30,
      256,
    );

    this.allowDynamoDB(createEventFunction);

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

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'updateEvent',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'updatePost',
    });
  }

  feedQuery() {
    const feedFunction = this.getFunction('feed', 'api-feed', 'feed', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
    });

    this.allowDynamoDB(feedFunction);
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

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'myEvents',
    });

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'upcomingEventsPrivate',
    });

    dataSource.createResolver({
      typeName: 'Club',
      fieldName: 'upcomingEventsCount',
      requestMappingTemplate: MappingTemplate.fromString(`
{
  "version" : "2017-02-28",
  "operation": "BatchInvoke",
  "payload": {
    "fieldName": "clubUpcomingEventsCount",
  	"source": $utils.toJson($context.source),
    "identity": $util.toJson($context.identity)
  }
}
`),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'Team',
      fieldName: 'upcomingEventsCount',
      requestMappingTemplate: MappingTemplate.fromString(`
{
  "version" : "2017-02-28",
  "operation": "BatchInvoke",
  "payload": {
    "fieldName": "teamUpcomingEventsCount",
  	"source": $utils.toJson($context.source),
    "identity": $util.toJson($context.identity)
  }
}
`),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });
  }

  syncContactsMutation() {
    const lambdaFunction = this.getFunction(
      'syncContacts',
      'api-syncContacts',
      'syncContacts',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        ES_DOMAIN: this.esDomain,
      },
      120,
      256,
    );

    this.allowDynamoDB(lambdaFunction);
    this.allowES(lambdaFunction);

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

  addLikeMutation() {
    const lambdaFunction = this.getFunction(
      'addLike',
      'api-addLike',
      'addLike',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
      },
      120,
    );

    this.allowDynamoDB(lambdaFunction);

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

  eventAuthorField() {
    const eventAuthorBatchFunction = this.getFunction(
      'eventAuthorBatch',
      'api-eventAuthorBatch',
      'eventAuthorBatch',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
      },
      120,
    );

    this.allowDynamoDB(eventAuthorBatchFunction);

    const lambdaDS = this.api.addLambdaDataSource(
      'eventAuthorBatchFunction',
      eventAuthorBatchFunction,
    );

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

  eventMyReactionField() {
    const eventMyReactionBatchFunction = this.getFunction(
      'eventMyReactionBatch',
      'api-eventMyReactionBatch',
      'eventMyReactionBatch',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
      },
      120,
    );

    this.allowDynamoDB(eventMyReactionBatchFunction);

    const lambdaDS = this.api.addLambdaDataSource(
      'eventMyReactionBatchFunction',
      eventMyReactionBatchFunction,
    );

    lambdaDS.createResolver({
      typeName: 'Event',
      fieldName: 'myReaction',
      requestMappingTemplate: MappingTemplate.fromString(`
{
  "version" : "2017-02-28",
  "operation": "BatchInvoke",
  "payload": {
  	"source": $utils.toJson($context.source),
    "identity": $util.toJson($context.identity)
  }
}
`),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    lambdaDS.createResolver({
      typeName: 'Post',
      fieldName: 'myReaction',
      requestMappingTemplate: MappingTemplate.fromString(`
{
  "version" : "2017-02-28",
  "operation": "BatchInvoke",
  "payload": {
  	"source": $utils.toJson($context.source),
    "identity": $util.toJson($context.identity)
  }
}
`),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });
  }

  eventParticipantsField() {
    const eventParticipantsBatchFunction = this.getFunction(
      'eventParticipantsBatch',
      'api-eventParticipantsBatch',
      'eventParticipantsBatch',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        ES_DOMAIN: this.esDomain,
      },
      120,
      256,
    );

    this.allowDynamoDB(eventParticipantsBatchFunction);
    this.allowES(eventParticipantsBatchFunction);

    const lambdaDS = this.api.addLambdaDataSource(
      'eventParticipantsBatchFunction',
      eventParticipantsBatchFunction,
    );

    lambdaDS.createResolver({
      typeName: 'Event',
      fieldName: 'participants',
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

  eventQuery() {
    const eventFunction = this.getFunction('event', 'api-event', 'event', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
    });

    this.allowDynamoDB(eventFunction);
    this.allowES(eventFunction);

    const dataSource = this.api.addLambdaDataSource('eventFunction', eventFunction);

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'event',
    });

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'post',
    });

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'eventPrivate',
    });

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'postPrivate',
    });
  }

  inviteParentMutation() {
    const inviteParentFunction = this.getFunction(
      'inviteParent',
      'api-inviteParent',
      'inviteParent',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        ES_DOMAIN: this.esDomain,
        INVITATION_URL: process.env.CHILD_INVITATION_URL,
      },
    );

    this.allowDynamoDB(inviteParentFunction);
    this.allowES(inviteParentFunction);
    this.allowEventBridge(inviteParentFunction);

    const dataSource = this.api.addLambdaDataSource('inviteParentFunction', inviteParentFunction);

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'inviteParent',
    });
  }

  acceptChildInvitationMutation() {
    const acceptChildInvitationFunction = this.getFunction(
      'acceptChildInvitation',
      'api-acceptChildInvitation',
      'acceptChildInvitation',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        ES_DOMAIN: this.esDomain,
      },
    );

    this.allowDynamoDB(acceptChildInvitationFunction);
    this.allowES(acceptChildInvitationFunction);
    this.allowEventBridge(acceptChildInvitationFunction);

    const dataSource = this.api.addLambdaDataSource(
      'acceptChildInvitationFunction',
      acceptChildInvitationFunction,
    );

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'acceptChildInvitation',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'declineChildInvitation',
    });
  }

  verifyPhoneMutation() {
    const verifyPhoneFunction = this.getFunction('verifyPhone', 'api-verifyPhone', 'verifyPhone', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
    });

    this.allowDynamoDB(verifyPhoneFunction);

    const snsPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    snsPolicy.addActions('sns:publish');
    snsPolicy.addResources('*');
    verifyPhoneFunction.addToRolePolicy(snsPolicy);

    const dataSource = this.api.addLambdaDataSource('verifyPhoneFunction', verifyPhoneFunction);

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'verifyPhone',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'sendPhoneVerification',
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

  allowEventBridge(lambdaFunction: lambda.Function) {
    const eventsPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    eventsPolicy.addActions('events:PutEvents');
    eventsPolicy.addResources('*');

    lambdaFunction.addToRolePolicy(eventsPolicy);
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

  getApiKeyExpiration(): cdk.Expiration {
    return cdk.Expiration.atDate(new Date(2021, 6, 1));
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
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'api', folderName), {
        exclude: ['*.ts'],
      }),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment,
      logRetention: RetentionDays.THREE_DAYS,
      logRetentionRetryOptions: {
        base: Duration.millis(200),
        maxRetries: 10,
      },
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(timeoutSeconds),
      memorySize,
    });
  }
}
