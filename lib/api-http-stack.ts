import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as apigateway from '@aws-cdk/aws-apigatewayv2';
import * as route53 from '@aws-cdk/aws-route53';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import { HttpMethod, LambdaProxyIntegration, HttpApi, DomainName } from '@aws-cdk/aws-apigatewayv2';

export interface ApiHttpStackProps extends cdk.StackProps {
  mainTable: dynamodb.Table;
  zoneId: string;
  zoneName: string;
  domain: string;
  certificateArn: string;
}

export class ApiHttpStack extends cdk.Stack {
  public readonly api: apigateway.HttpApi;
  private readonly mainTable: dynamodb.Table;

  constructor(scope: cdk.Construct, id: string, props: ApiHttpStackProps) {
    super(scope, id, props);

    const { mainTable, zoneId, zoneName, domain, certificateArn } = props;
    this.mainTable = mainTable;

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
    const fn = this.getFunction(
      'treezorWebhook',
      {
        MAIN_TABLE_NAME: this.mainTable.tableName,
      },
      120,
      256,
    );

    this.mainTable.grantReadWriteData(fn);

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
