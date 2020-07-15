import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as route53 from '@aws-cdk/aws-route53';
import * as route53tg from '@aws-cdk/aws-route53-targets';
import { Certificate, ICertificate } from '@aws-cdk/aws-certificatemanager';
import { CloudFrontWebDistribution, OriginProtocolPolicy } from '@aws-cdk/aws-cloudfront';

export interface WebSiteStackProps extends cdk.StackProps {
  bucketName: string;
  bucketRefererHeader: string;
  zoneId: string;
  zoneName: string;
  domain: string;
  certificateArn: string;
}

export class WebSiteStack extends cdk.Stack {
  public readonly zone: route53.IHostedZone;

  constructor(scope: cdk.Construct, id: string, props: WebSiteStackProps) {
    super(scope, id, props);

    const { bucketName, bucketRefererHeader, zoneId, zoneName, domain, certificateArn } = props;

    /**
     * Create S3 Bucket. Enable static Web Site
     */
    const bucket = this.createS3Bucket(bucketName, bucketRefererHeader);

    /**
     * Create CloudFront
     */
    const certificate = Certificate.fromCertificateArn(this, 'us-certificate', certificateArn);
    const distribution = this.createCloudFrontDistribution(
      bucket.bucketWebsiteDomainName,
      domain,
      certificate,
      bucketRefererHeader,
    );

    /**
     * Add record to Route53
     */
    this.createDomainRecord(zoneId, zoneName, domain, distribution);
  }

  createS3Bucket(bucketName: string, bucketRefererHeader: string) {
    const bucket = new s3.Bucket(this, `s3-bucket-${bucketName}`, {
      bucketName,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
    });

    const bucketPolicy = bucket.grantPublicAccess('*', 's3:GetObject');
    bucketPolicy.resourceStatement!.addResources(bucket.bucketArn);
    bucketPolicy.resourceStatement!.sid = 'AllowByRefererHeader';
    bucketPolicy.resourceStatement!.addCondition('StringEquals', {
      'aws:Referer': bucketRefererHeader,
    });

    return bucket;
  }

  createCloudFrontDistribution(
    bucketWebsiteDomain: string,
    domain: string,
    certificate: ICertificate,
    bucketRefererHeader: string,
  ) {
    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'cloudfront-appsync-api', {
      originConfigs: [
        {
          customOriginSource: {
            domainName: bucketWebsiteDomain,
            originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          },
          behaviors: [{ isDefaultBehavior: true, compress: true }],
          originHeaders: {
            Referer: bucketRefererHeader,
          },
        },
      ],
      viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(certificate, {
        aliases: [domain],
      }),
    });

    return distribution;
  }

  createDomainRecord(
    zoneId: string,
    zoneName: string,
    domain: string,
    distribution: CloudFrontWebDistribution,
  ) {
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'zone-tifo-sport', {
      hostedZoneId: zoneId,
      zoneName,
    });

    new route53.ARecord(this, `record-${domain}`, {
      zone: hostedZone,
      recordName: domain,
      target: route53.RecordTarget.fromAlias(new route53tg.CloudFrontTarget(distribution)),
    });
  }
}
