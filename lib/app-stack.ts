import * as cdk from '@aws-cdk/core';

interface AppStackProps extends cdk.StackProps {
  prod: boolean
}

export class AppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
  }
}
