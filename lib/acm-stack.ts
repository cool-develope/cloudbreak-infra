import * as cdk from '@aws-cdk/core';
import { Certificate, ValidationMethod } from '@aws-cdk/aws-certificatemanager';

export interface AcmStackProps extends cdk.StackProps {
  domainName: string;
}

export class AcmStack extends cdk.Stack {
  public readonly certificate: Certificate;

  constructor(scope: cdk.Construct, id: string, props: AcmStackProps) {
    super(scope, id, props);

    const { domainName } = props;

    this.certificate = new Certificate(this, 'certificate-tifo-sport', {
      domainName,
      subjectAlternativeNames: [`*.${domainName}`],
      validationMethod: ValidationMethod.DNS,
    });

    new cdk.CfnOutput(this, 'certificate-arn', { value: this.certificate.certificateArn });
  }
}
