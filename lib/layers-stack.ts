import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';

export class LayersStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const commonModules = new lambda.LayerVersion(this, 'layers-common-modules', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'layers', 'common-modules')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_12_X],
      description: 'UUID, Elasticsearch, Xray',
      layerVersionName: 'common-modules',
    });

    new cdk.CfnOutput(this, 'layer-modules', { value: commonModules.layerVersionArn });
  }
}
