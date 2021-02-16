import * as cdk from '@aws-cdk/core';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as route53 from '@aws-cdk/aws-route53';
import * as route53tg from '@aws-cdk/aws-route53-targets';
import { Certificate, ICertificate } from '@aws-cdk/aws-certificatemanager';
import { CloudFrontWebDistribution } from '@aws-cdk/aws-cloudfront';
import { Duration } from '@aws-cdk/core';

export interface ApiDomainStackProps extends cdk.StackProps {
  zoneId: string;
  zoneName: string;
  apiDomain: string;
  appSyncDomain: string;
  certificateArn: string;
}

export class ApiDomainStack extends cdk.Stack {
  public readonly zone: route53.IHostedZone;

  constructor(scope: cdk.Construct, id: string, props: ApiDomainStackProps) {
    super(scope, id, props);

    const { zoneId, zoneName, apiDomain, certificateArn, appSyncDomain } = props;

    const certificate = Certificate.fromCertificateArn(this, 'us-certificate', certificateArn);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'zone-tifo-sport', {
      hostedZoneId: zoneId,
      zoneName,
    });

    const distribution = this.createCloudFrontDistribution(appSyncDomain, apiDomain, certificate);
    this.createDomainRecord(hostedZone, apiDomain, distribution);
  }

  createCloudFrontDistribution(
    appSyncDomain: string,
    apiDomain: string,
    certificate: ICertificate,
  ) {
    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'cloudfront-appsync-api', {
      originConfigs: [
        {
          customOriginSource: {
            domainName: appSyncDomain,
            originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              allowedMethods: cloudfront.CloudFrontAllowedMethods.ALL,
              defaultTtl: Duration.seconds(0),
              maxTtl: Duration.seconds(0),
              minTtl: Duration.seconds(0),
            },
          ],
        },
      ],
      viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(certificate, {
        aliases: [apiDomain],
      }),
    });

    return distribution;
  }

  createDomainRecord(
    hostedZone: route53.IHostedZone,
    recordName: string,
    distribution: CloudFrontWebDistribution,
  ) {
    new route53.ARecord(this, 'record-api-tifo-sport', {
      zone: hostedZone,
      recordName,
      target: route53.RecordTarget.fromAlias(new route53tg.CloudFrontTarget(distribution)),
    });
  }
}
