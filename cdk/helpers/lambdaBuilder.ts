import * as path from 'path';
import { Duration, Construct } from '@aws-cdk/core';
import { ILayerVersion, Runtime, Tracing } from '@aws-cdk/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from '@aws-cdk/aws-lambda-nodejs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export enum FunctionPrefix {
  api = 'api',
  cognito = 'cognito',
  events = 'events',
  http = 'http',
}

export default class LambdaBuilder {
  private props: Mutable<NodejsFunctionProps>;

  constructor(
    private scope: Construct,
    private functionName: string,
    private functionPrefix: FunctionPrefix,
  ) {
    this.props = {
      bundling: {
        target: 'node14',
        nodeModules: [],
        externalModules: [],
      },
      tracing: Tracing.ACTIVE,
      runtime: Runtime.NODEJS_14_X,
      handler: 'handler',
      timeout: Duration.seconds(30),
      initialPolicy: [],
      layers: [],
    };
  }

  setEnv(env: { [key: string]: string }) {
    this.props.environment = env;
    return this;
  }

  setTimeout(seconds: number) {
    this.props.timeout = Duration.seconds(seconds);
    return this;
  }

  setMemory(mb: number) {
    this.props.memorySize = mb;
    return this;
  }

  addLayer(layer: ILayerVersion) {
    this.props.layers?.push(layer);
    return this;
  }

  addExternalModules(moduleNames: string | string[]) {
    if (Array.isArray(moduleNames)) {
      this.props.bundling?.externalModules?.push(...moduleNames);
    } else {
      this.props.bundling?.externalModules?.push(moduleNames);
    }
    return this;
  }

  addPolicy(policy: PolicyStatement) {
    this.props.initialPolicy?.push(policy);
    return this;
  }

  allowDynamoDB(tableName: string, region: string, accountId: string) {
    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'dynamodb:BatchGetItem',
        'dynamodb:GetRecords',
        'dynamodb:GetShardIterator',
        'dynamodb:Query',
        'dynamodb:GetItem',
        'dynamodb:Scan',
        'dynamodb:BatchWriteItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
      ],
      resources: [
        `arn:aws:dynamodb:${region}:${accountId}:table/${tableName}`,
        `arn:aws:dynamodb:${region}:${accountId}:table/${tableName}/index/*`,
      ],
    });

    return this.addPolicy(policy);
  }

  allowElasticsearch() {
    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['es:ESHttpGet', 'es:ESHttpHead'],
      resources: ['*'],
    });

    return this.addPolicy(policy);
  }

  allowEventBridge() {
    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: ['*'],
    });

    return this.addPolicy(policy);
  }

  build() {
    const fullFunctionName = `${this.functionPrefix}-${this.functionName}`;
    const id = `${fullFunctionName}Fn`;

    return new NodejsFunction(this.scope, id, {
      functionName: fullFunctionName,
      entry: path.join(
        __dirname,
        '../../',
        'functions',
        this.functionPrefix,
        this.functionName,
        'index.ts',
      ),
      ...this.props,
    });
  }
}
