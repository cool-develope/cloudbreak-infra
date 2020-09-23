import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';
import { ITable } from '@aws-cdk/aws-dynamodb';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';

export interface Api2StackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  dictionaryTable: dynamodb.Table;
  mainTable: dynamodb.Table;
  imagesDomain: string;
  esDomain: string;
  graphqlApiId: string;
  commonModulesLayerArn: string;
  commonCodeLayerArn: string;
}

export class Api2Stack extends cdk.Stack {
  public readonly api: appsync.IGraphqlApi;
  public readonly dictionaryTable: dynamodb.Table;
  public readonly mainTable: dynamodb.Table;
  public readonly imagesDomain: string;
  public readonly esDomain: string;
  private readonly userPool: cognito.UserPool;
  private readonly commonModulesLayer: lambda.ILayerVersion;
  private readonly commonCodeLayer: lambda.ILayerVersion;

  constructor(scope: cdk.Construct, id: string, props: Api2StackProps) {
    super(scope, id, props);

    const {
      userPool,
      dictionaryTable,
      mainTable,
      imagesDomain,
      esDomain,
      graphqlApiId,
      commonModulesLayerArn,
      commonCodeLayerArn,
    } = props;

    this.userPool = userPool;
    this.dictionaryTable = dictionaryTable;
    this.mainTable = mainTable;
    this.imagesDomain = imagesDomain;
    this.esDomain = esDomain;

    this.api = appsync.GraphqlApi.fromGraphqlApiAttributes(this, 'api2-appsync', { graphqlApiId });

    this.commonModulesLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'api2-layers-common-modules',
      commonModulesLayerArn,
    );

    this.commonCodeLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'api2-layers-common-code',
      commonCodeLayerArn,
    );

    /**
     * Query: countries, languages
     */
    this.dictionaryQuery();

    /**
     * Mutation: createTreezorUser
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
     * Query: club, clubs
     */
    this.clubQuery();

    /**
     * Mutation: createCompanyPrivate, updateCompanyPrivate
     * Query: companyPrivate
     */
    this.companyQuery();
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
        COGNITO_USERPOOL_ID: this.userPool.userPoolId,
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

  sendMoneyRequestMutation() {
    const { ONESIGNAL_API_KEY, ONESIGNAL_APP_ID } = process.env;

    const fn = this.getFunction('sendMoneyRequest', 'api-sendMoneyRequest', 'sendMoneyRequest', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
      ONESIGNAL_APP_ID,
      ONESIGNAL_API_KEY,
    });

    this.mainTable.grantReadWriteData(fn);
    this.allowES(fn);

    const dataSource = this.api.addLambdaDataSource('sendMoneyRequestFn', fn);

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'sendMoneyRequest',
    });
  }

  cardTypesQuery() {
    const fn = this.getFunction('cardTypes', 'api-cardTypes', 'cardTypes', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
    });

    this.mainTable.grantReadWriteData(fn);

    const dataSource = this.api.addLambdaDataSource('cardTypesFn', fn);

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'cardTypes',
    });
  }

  clubQuery() {
    const fn = this.getFunction('club', 'api-club', 'club', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain,
      ES_DOMAIN: this.esDomain,
    });

    this.mainTable.grantReadWriteData(fn);
    this.allowES(fn);

    const dataSource = this.api.addLambdaDataSource('clubFn', fn);

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'createClubPrivate',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'updateClubPrivate',
    });

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'club',
    });

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'clubs',
    });
  }

  companyQuery() {
    const fn = this.getFunction('company', 'api-company', 'company', {
      MAIN_TABLE_NAME: this.mainTable.tableName,
      IMAGES_DOMAIN: this.imagesDomain
    });

    this.mainTable.grantReadWriteData(fn);
    const dataSource = this.api.addLambdaDataSource('companyFn', fn);

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'createCompanyPrivate',
    });

    dataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'updateCompanyPrivate',
    });

    dataSource.createResolver({
      typeName: 'Query',
      fieldName: 'companyPrivate',
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
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'api', folderName), {
        exclude: ['*.ts'],
      }),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment,
      logRetention: RetentionDays.THREE_DAYS,
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(timeoutSeconds),
      memorySize,
      layers: [this.commonModulesLayer],
    });
  }
}
