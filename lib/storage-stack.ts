import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as route53 from '@aws-cdk/aws-route53';
import * as route53tg from '@aws-cdk/aws-route53-targets';
import * as lambda from '@aws-cdk/aws-lambda';
import { Certificate, ICertificate } from '@aws-cdk/aws-certificatemanager';
import {
  CloudFrontWebDistribution,
  OriginAccessIdentity,
  LambdaEdgeEventType,
} from '@aws-cdk/aws-cloudfront';

export interface StorageStackProps extends cdk.StackProps {
  bucketName: string;
  zoneId: string;
  zoneName: string;
  domain: string;
  certificateArn: string;
  imagesOriginRequestArn: string;
}

export class StorageStack extends cdk.Stack {
  public readonly zone: route53.IHostedZone;

  constructor(scope: cdk.Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { bucketName, zoneId, zoneName, domain, certificateArn, imagesOriginRequestArn } = props;

    /**
     * Create S3 Bucket. Enable static Web Site
     */
    const bucket = this.createS3Bucket(bucketName);

    /**
     * Create CloudFront
     */
    const certificate = Certificate.fromCertificateArn(this, 'us-certificate', certificateArn);
    const imagesOriginRequestVersion = lambda.Version.fromVersionArn(this, 'imagesOriginRequestVersion', imagesOriginRequestArn);
    
    const distribution = this.createCloudFrontDistribution(
      bucket,
      domain,
      certificate,
      imagesOriginRequestVersion,
    );

    /**
     * Add record to Route53
     */
    this.createDomainRecord(zoneId, zoneName, domain, distribution);
  }

  createS3Bucket(bucketName: string) {
    const bucket = new s3.Bucket(this, `s3-bucket-${bucketName}`, {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
            s3.HttpMethods.HEAD,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: [
            'x-amz-server-side-encryption',
            'x-amz-request-id',
            'x-amz-id-2',
            'ETag',
          ],
          maxAge: 3000,
        },
      ],
    });

    return bucket;
  }

  createCloudFrontDistribution(
    bucket: s3.Bucket,
    domain: string,
    certificate: ICertificate,
    imagesOriginRequestVersion: lambda.IVersion,
  ) {
    const cloudFrontOAI = new OriginAccessIdentity(this, `${domain}-OAI`, {
      comment: `OAI for ${bucket.bucketName}`,
    });

    const distribution = new cloudfront.CloudFrontWebDistribution(this, `${domain}-cloudfront`, {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: bucket,
            originAccessIdentity: cloudFrontOAI,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              lambdaFunctionAssociations: [
                {
                  eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
                  lambdaFunction: imagesOriginRequestVersion
                },
              ],
            },
          ],
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
