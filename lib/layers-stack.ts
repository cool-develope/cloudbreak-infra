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

    const commonCode = new lambda.LayerVersion(this, 'layers-common-code', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'layers', 'common-code')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_12_X],
      description: 'Models, DynamoHelper',
      layerVersionName: 'common-code',
    });

    new cdk.CfnOutput(this, 'layer-modules', { value: commonModules.layerVersionArn });
    new cdk.CfnOutput(this, 'layer-code', { value: commonCode.layerVersionArn });
  }
}
