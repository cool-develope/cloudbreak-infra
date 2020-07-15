import * as cdk from '@aws-cdk/core';
import { Certificate, ValidationMethod } from '@aws-cdk/aws-certificatemanager';

export class AcmStack extends cdk.Stack {
  public readonly certificate: Certificate;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.certificate = new Certificate(this, 'certificate-tifo-sport', {
      domainName: 'tifo-sport.com',
      subjectAlternativeNames: ['*.tifo-sport.com'],
      validationMethod: ValidationMethod.DNS,
    });

    new cdk.CfnOutput(this, 'certificate-arn', { value: this.certificate.certificateArn });
  }
}
