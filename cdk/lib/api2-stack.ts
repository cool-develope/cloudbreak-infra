import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import { Fn } from '@aws-cdk/core';
import { MappingTemplate } from '@aws-cdk/aws-appsync';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { Duration } from '@aws-cdk/core';
import { LambdaBuilder, FunctionPrefix, getBatchTemplate, ResolverType } from '../helpers';

export interface Api2StackProps extends cdk.StackProps {
  imagesDomain: string;
  commonModulesLayerArn: string;
  imageProcessingLayerArn: string;
}

export class Api2Stack extends cdk.Stack {
  public readonly api: appsync.IGraphqlApi;
  public readonly dictionaryTable: dynamodb.ITable;
  public readonly mainTable: dynamodb.ITable;
  public readonly imagesDomain: string;
  public readonly esDomain: string;
  private readonly userPoolId: string;
  private readonly commonModulesLayer: lambda.ILayerVersion;
  private readonly imageProcessingLayer: lambda.ILayerVersion;

  constructor(scope: cdk.Construct, id: string, props: Api2StackProps) {
    super(scope, id, props);

    const { imagesDomain, commonModulesLayerArn, imageProcessingLayerArn } = props;
    const { MAIN_TABLE_NAME = '', DICTIONARY_TABLE_NAME = '' } = process.env;

    this.mainTable = dynamodb.Table.fromTableName(this, 'MTable', MAIN_TABLE_NAME);
    this.dictionaryTable = dynamodb.Table.fromTableName(this, 'DTable', DICTIONARY_TABLE_NAME);
    this.imagesDomain = imagesDomain;
    this.esDomain = `https://${Fn.importValue('EsDomainEndpoint')}`;
    this.userPoolId = Fn.importValue('UserPoolId');
    this.api = appsync.GraphqlApi.fromGraphqlApiAttributes(this, 'api2-appsync', {
      graphqlApiId: Fn.importValue('AppSyncApiId'),
    });

    this.commonModulesLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'api2-layers-common-modules',
      commonModulesLayerArn,
    );

    this.imageProcessingLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'api2-layers-image-processing',
      imageProcessingLayerArn,
    );

    /**
     * Query: countries, languages
     */
    this.dictionaryQuery();

    /**
     * Mutation: createTreezorUser, createTreezorCompany
     */
    this.createTreezorUserMutation();

    /**
     * Mutation: sendMoneyRequest
     */
    this.sendMoneyRequestMutation();

    /**
     * Query: cardTypes
     */
    this.cardTypesQuery();

    /**
     * Mutation: createClubPrivate, updateClubPrivate
     * Query: club, clubs, clubsPrivate
     */
    this.clubQuery();

    /**
     * Mutation: createCompanyPrivate, updateCompanyPrivate
     * Query: companyPrivate
     */
    this.companyQuery();

    /**
     * Mutation: createTeamPrivate, updateTeamPrivate
     * Query: team
     */
    this.team();

    /**
     * Mutation: sendTeamInvitation, acceptTeamInvitationPrivate, declineTeamInvitationPrivate
     */
    this.teamInvitation();

    this.user();

    this.notifications();

    this.eventOrganizationField();

    this.federation();

    this.treezor();

    this.submitSupportTicket();

    this.qrPayments();
  }

  dictionaryQuery() {
    const dictionaryFunction = this.getFunction('dictionary', 'api-dictionary', 'dictionary');

    this.dictionaryTable.grantReadData(dictionaryFunction);

    const dictionaryDS = this.api.addLambdaDataSource('dictionaryFunction', dictionaryFunction);

    dictionaryDS.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'countries',
    });

    dictionaryDS.createResolver({
      typeName: ResolverType.Query,
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
        COGNITO_USERPOOL_ID: this.userPoolId,
        TREEZOR_BASE_URL,
        TREEZOR_CLIENT_ID,
        TREEZOR_CLIENT_SECRET,
      },
    );

    this.allowDynamoDB(createTreezorUserFunction);
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
      typeName: ResolverType.Mutation,
      fieldName: 'createTreezorUser',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'createTreezorCompany',
    });
  }

  sendMoneyRequestMutation() {
    const { ONESIGNAL_API_KEY, ONESIGNAL_APP_ID } = process.env;

    const fn = this.getFunction('sendMoneyRequest', 'api-sendMoneyRequest', 'sendMoneyRequest', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
      ONESIGNAL_APP_ID,
      ONESIGNAL_API_KEY,
    });

    this.allowDynamoDB(fn);
    this.allowES(fn);
    this.allowEventBridge(fn);

    const dataSource = this.api.addLambdaDataSource('sendMoneyRequestFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'sendMoneyRequest',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'rejectMoneyRequest',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'approveMoneyRequest',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'moneyRequests',
    });
  }

  cardTypesQuery() {
    const fn = this.getFunction('cardTypes', 'api-cardTypes', 'cardTypes', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
    });

    this.allowDynamoDB(fn);

    const dataSource = this.api.addLambdaDataSource('cardTypesFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'cardTypes',
    });
  }

  clubQuery() {
    const fn = this.getFunction('club', 'api-club', 'club', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
      COGNITO_USERPOOL_ID: this.userPoolId,
    });

    this.allowDynamoDB(fn);
    this.allowES(fn);

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

    const dataSource = this.api.addLambdaDataSource('clubFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'createClubPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'updateClubPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'club',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'clubs',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'clubsPrivate',
    });
  }

  companyQuery() {
    const fn = this.getFunction('company', 'api-company', 'company', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
    });

    this.allowDynamoDB(fn);
    const dataSource = this.api.addLambdaDataSource('companyFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'createCompanyPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'updateCompanyPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'companyPrivate',
    });
  }

  team() {
    const fn = this.getFunction('team', 'api-team', 'team', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
    });

    this.allowDynamoDB(fn);
    this.allowES(fn);

    const dataSource = this.api.addLambdaDataSource('teamFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'createTeamPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'updateTeamPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'team',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'teamsPrivate',
    });

    dataSource.createResolver({
      typeName: 'Team',
      fieldName: 'parentTeam',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('parentTeam')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'Team',
      fieldName: 'children',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('childrenTeams')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'Club',
      fieldName: 'teams',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('clubTeams')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });
  }

  teamInvitation() {
    const fn = this.getFunction('teamInvitation', 'api-teamInvitation', 'teamInvitation', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
    });

    this.allowDynamoDB(fn);
    this.allowES(fn);
    this.allowEventBridge(fn);

    const dataSource = this.api.addLambdaDataSource('teamInvitationFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'sendTeamInvitation',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'acceptTeamInvitationPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'declineTeamInvitationPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'changeTeamRolePrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'approveTeamInvitationByParent',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'rejectTeamInvitationByParent',
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

  user() {
    const fn = this.getFunction('user', 'api-user', 'user', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
    });

    this.allowDynamoDB(fn);
    this.allowES(fn);

    const dataSource = this.api.addLambdaDataSource('userFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'usersPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'userPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'updateUserPrivate',
    });

    dataSource.createResolver({
      typeName: 'Club',
      fieldName: 'coaches',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('clubCoaches')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'Club',
      fieldName: 'members',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('clubMembers')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'Club',
      fieldName: 'friends',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('clubFriends')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'Team',
      fieldName: 'coaches',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('teamCoaches')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'Team',
      fieldName: 'members',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('teamMembers')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'Team',
      fieldName: 'friends',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('teamFriends')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });
  }

  notifications() {
    const fn = this.getFunction('notifications', 'api-notifications', 'notifications', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
    });

    this.allowDynamoDB(fn);
    this.allowES(fn);

    const dataSource = this.api.addLambdaDataSource('notificationsFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'notifications',
    });
  }

  eventOrganizationField() {
    const fn = this.getFunction(
      'eventOrganizationBatch',
      'api-eventOrganizationBatch',
      'eventOrganizationBatch',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        ES_DOMAIN: this.esDomain,
      },
    );

    this.allowDynamoDB(fn);
    this.allowES(fn);

    const dataSource = this.api.addLambdaDataSource('eventOrganizationBatchFn', fn);

    dataSource.createResolver({
      typeName: 'Event',
      fieldName: 'organization',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('eventOrganization')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'Post',
      fieldName: 'organization',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('eventOrganization')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });
  }

  federation() {
    const fn = this.getFunction('federation', 'api-federation', 'federation', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
      COGNITO_USERPOOL_ID: this.userPoolId,
    });

    this.allowDynamoDB(fn);
    this.allowES(fn);

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

    const dataSource = this.api.addLambdaDataSource('federationFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'createFederationPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'updateFederationPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'federationsPrivate',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'federation',
    });

    dataSource.createResolver({
      typeName: 'Federation',
      fieldName: 'children',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('childrenFederation')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'Team',
      fieldName: 'federations',
      requestMappingTemplate: MappingTemplate.fromString(getBatchTemplate('teamFederations')),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });
  }

  treezor() {
    const { TREEZOR_BASE_URL, TREEZOR_CLIENT_ID, TREEZOR_CLIENT_SECRET } = process.env;

    const fn = this.getFunction(
      'treezor',
      'api-treezor',
      'treezor',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        ES_DOMAIN: this.esDomain,
        COGNITO_USERPOOL_ID: this.userPoolId,
        TREEZOR_BASE_URL,
        TREEZOR_CLIENT_ID,
        TREEZOR_CLIENT_SECRET,
      },
      360,
      256,
    );

    this.allowDynamoDB(fn);
    this.allowES(fn);

    const cognitoPolicy = new PolicyStatement({ effect: Effect.ALLOW });
    cognitoPolicy.addActions('cognito-idp:AdminGetUser');
    cognitoPolicy.addResources('*');
    fn.addToRolePolicy(cognitoPolicy);

    const dataSource = this.api.addLambdaDataSource('treezorFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'transactions',
    });
  }

  submitSupportTicket() {
    const fn = this.getFunction(
      'submitSupportTicket',
      'api-submitSupportTicket',
      'submitSupportTicket',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        SES_FROM_ADDRESS: 'cloudbreak <no-reply@cloudbreak-telehealth.com>',
        SES_REGION: 'eu-west-1',
      },
    );

    this.allowDynamoDB(fn);
    this.allowSES(fn);

    const dataSource = this.api.addLambdaDataSource('submitSupportTicketFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'submitSupportTicket',
    });
  }

  qrPayments() {
    const { IMAGES_BUCKET_NAME = '-' } = process.env;

    const s3PolicyQr = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
      resources: [`arn:aws:s3:::${IMAGES_BUCKET_NAME}/club/*/qr/*`],
    });

    const s3PolicyLogo = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:GetObject'],
      resources: [`arn:aws:s3:::${IMAGES_BUCKET_NAME}/logo.jpeg`],
    });

    const fn = new LambdaBuilder(this, 'qrPayments', FunctionPrefix.api)
      .setEnv({
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        IMAGES_BUCKET_NAME,
      })
      .setTimeout(30)
      .setMemory(256)
      .addExternalModules(['qrcode', 'sharp', 'uuid'])
      .allowDynamoDB(this.mainTable.tableName, this.region, this.account)
      .addLayer(this.commonModulesLayer)
      .addLayer(this.imageProcessingLayer)
      .addPolicy(s3PolicyQr)
      .addPolicy(s3PolicyLogo)
      .build();

    const dataSource = this.api.addLambdaDataSource('qrPaymentsFn', fn);

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'createQrPaymentCategory',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'updateQrPaymentCategory',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'deleteQrPaymentCategory',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'qrPaymentCategories',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'createQrPayment',
    });

    dataSource.createResolver({
      typeName: ResolverType.Mutation,
      fieldName: 'deleteQrPayment',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'qrPayment',
    });

    dataSource.createResolver({
      typeName: ResolverType.Query,
      fieldName: 'qrPayments',
    });

    dataSource.createResolver({
      typeName: 'QrPayment',
      fieldName: 'category',
      requestMappingTemplate: MappingTemplate.fromString(
        getBatchTemplate('batchQrPaymentCategory'),
      ),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });

    dataSource.createResolver({
      typeName: 'QrPayment',
      fieldName: 'transactions',
      requestMappingTemplate: MappingTemplate.fromString(
        getBatchTemplate('batchQrPaymentTransactions'),
      ),
      responseMappingTemplate: MappingTemplate.fromString('$util.toJson($context.result)'),
    });
  }

  allowSES(lambdaFunction: lambda.Function) {
    const sesPolicy = new PolicyStatement({ effect: Effect.ALLOW });
    sesPolicy.addActions('ses:SendEmail');
    sesPolicy.addResources('*');
    lambdaFunction.addToRolePolicy(sesPolicy);
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
      'arn:aws:dynamodb:eu-central-1:596882852595:table/cloudbreak',
      'arn:aws:dynamodb:eu-central-1:596882852595:table/cloudbreak/index/*',
    );

    lambdaFunction.addToRolePolicy(dbPolicy);
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
      code: lambda.Code.fromAsset(path.join(__dirname, '../../', 'functions', 'api', folderName), {
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
      layers: [this.commonModulesLayer],
    });
  }
}
