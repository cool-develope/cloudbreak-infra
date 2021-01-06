import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as apigateway from '@aws-cdk/aws-apigatewayv2';
import * as route53 from '@aws-cdk/aws-route53';
import { Fn } from '@aws-cdk/core';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import { HttpMethod, HttpApi, DomainName } from '@aws-cdk/aws-apigatewayv2';
import { LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';

export interface ApiHttpStackProps extends cdk.StackProps {
  zoneId: string;
  zoneName: string;
  domain: string;
  certificateArn: string;
  imagesDomain: string;
}

export class ApiHttpStack extends cdk.Stack {
  public readonly api: apigateway.HttpApi;
  private readonly mainTable: dynamodb.ITable;
  private readonly imagesDomain: string;
  private readonly esDomain: string;
  private readonly userPoolId: string;

  constructor(scope: cdk.Construct, id: string, props: ApiHttpStackProps) {
    super(scope, id, props);

    const { zoneId, zoneName, domain, certificateArn, imagesDomain } = props;
    const { MAIN_TABLE_NAME = '' } = process.env;

    this.mainTable = dynamodb.Table.fromTableName(this, 'MTable', MAIN_TABLE_NAME);
    this.imagesDomain = imagesDomain;
    this.esDomain = `https://${Fn.importValue('EsDomainEndpoint')}`;
    this.userPoolId = Fn.importValue('UserPoolId');

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
      TREEZOR_TIFO_WALLET_ID,
      ONESIGNAL_API_KEY,
      ONESIGNAL_APP_ID,
    } = process.env;

    const fn = this.getFunction(
      'treezorWebhook',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
        IMAGES_DOMAIN: this.imagesDomain,
        ES_DOMAIN: this.esDomain,
        COGNITO_USERPOOL_ID: this.userPoolId,
        TREEZOR_BASE_URL,
        TREEZOR_CLIENT_ID,
        TREEZOR_CLIENT_SECRET,
        TREEZOR_TIFO_WALLET_ID,
        ONESIGNAL_APP_ID,
        ONESIGNAL_API_KEY,
      },
      180,
      512,
    );

    this.allowDynamoDB(fn);
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
