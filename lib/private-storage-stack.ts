import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';

export interface PrivateStorageStackProps extends cdk.StackProps {
  bucketName: string;
}

export class PrivateStorageStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PrivateStorageStackProps) {
    super(scope, id, props);

    const { bucketName } = props;

    const bucket = new s3.Bucket(this, `s3-bucket-${bucketName}`, {
      bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS_MANAGED,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.POST, s3.HttpMethods.PUT, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });
  }
}
