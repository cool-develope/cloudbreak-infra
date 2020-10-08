import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as apigateway from '@aws-cdk/aws-apigatewayv2';
import * as route53 from '@aws-cdk/aws-route53';
import * as cognito from '@aws-cdk/aws-cognito';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import { HttpMethod, LambdaProxyIntegration, HttpApi, DomainName } from '@aws-cdk/aws-apigatewayv2';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';

export interface ApiHttpStackProps extends cdk.StackProps {
  mainTable: dynamodb.Table;
  zoneId: string;
  zoneName: string;
  domain: string;
  certificateArn: string;
  userPool: cognito.UserPool;
  imagesDomain: string;
  esDomain: string;
}

export class ApiHttpStack extends cdk.Stack {
  public readonly api: apigateway.HttpApi;
  private readonly mainTable: dynamodb.Table;
  private readonly imagesDomain: string;
  private readonly esDomain: string;
  private readonly userPool: cognito.UserPool;

  constructor(scope: cdk.Construct, id: string, props: ApiHttpStackProps) {
    super(scope, id, props);

    const {
      mainTable,
      zoneId,
      zoneName,
      domain,
      certificateArn,
      userPool,
      imagesDomain,
      esDomain,
    } = props;

    this.mainTable = mainTable;
    this.userPool = userPool;
    this.imagesDomain = imagesDomain;
    this.esDomain = esDomain;

    const certificate = Certificate.fromCertificateArn(this, 'http-api-cert', certificateArn);
    const domainName = new DomainName(this, 'HttpApiDomain', {
      domainName: domain,
      certificate: certificate,
    });

    /**
     * Create HTTP API Gateway
     */
    this.api = new HttpApi(this, 'HttpApi', {
      apiName: 'tifo-http-api',
      defaultDomainMapping: {
        domainName,
      },
    });

    /**
     * Add record to Route53
     */
    this.createDomainRecord(zoneId, zoneName, domain, domainName.regionalDomainName);

    /**
     * Add routes
     */
    this.addTreezorWebhook();
  }

  addTreezorWebhook() {
    const {
      TREEZOR_BASE_URL,
      TREEZOR_CLIENT_ID,
      TREEZOR_CLIENT_SECRET,
      ONESIGNAL_API_KEY,
      ONESIGNAL_APP_ID,
    } = process.env;

    const fn = this.getFunction(
      'treezorWebhook',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        ES_DOMAIN: this.esDomain,
        COGNITO_USERPOOL_ID: this.userPool.userPoolId,
        TREEZOR_BASE_URL,
        TREEZOR_CLIENT_ID,
        TREEZOR_CLIENT_SECRET,
        ONESIGNAL_APP_ID,
        ONESIGNAL_API_KEY,
      },
      180,
      512,
    );

    this.mainTable.grantReadWriteData(fn);
    this.allowES(fn);
    this.allowEventBridge(fn);

    const cognitoPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    cognitoPolicy.addActions('cognito-idp:AdminUpdateUserAttributes', 'cognito-idp:AdminGetUser');
    cognitoPolicy.addResources('*');
    fn.addToRolePolicy(cognitoPolicy);

    const fnIntegration = new LambdaProxyIntegration({
      handler: fn,
    });

    this.api.addRoutes({
      path: '/treezor/webhook',
      methods: [HttpMethod.POST],
      integration: fnIntegration,
    });
  }

  createDomainRecord(zoneId: string, zoneName: string, domain: string, apiDomain: string) {
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'zone-tifo-sport', {
      hostedZoneId: zoneId,
      zoneName,
    });

    new route53.CnameRecord(this, `record-${domain}`, {
      zone: hostedZone,
      recordName: domain,
      domainName: apiDomain,
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

  getFunction(functionName: string, environment?: any, timeoutSeconds = 30, memorySize = 128) {
    return new lambda.Function(this, `http-${functionName}-fn`, {
      functionName: `hapi-${functionName}`,
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'http', functionName)),
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
