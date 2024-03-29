import * as cdk from '@aws-cdk/core';
import * as es from '@aws-cdk/aws-elasticsearch';

export interface ElasticsearchStackProps extends cdk.StackProps {}

export class ElasticsearchStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ElasticsearchStackProps) {
    super(scope, id, props);

    const domain = new es.CfnDomain(this, 'data-elasticsearch', {
      domainName: 'data-es',
      elasticsearchVersion: '7.7',
      elasticsearchClusterConfig: {
        instanceCount: 1,
        instanceType: 't2.small.elasticsearch',
        dedicatedMasterEnabled: false,
        // dedicatedMasterType: 't2.small.elasticsearch',
        // dedicatedMasterCount: 0,
      },
      ebsOptions: {
        ebsEnabled: true,
        volumeSize: 10,
        volumeType: 'gp2',
      },
    });

    new cdk.CfnOutput(this, 'EsDomainEndpoint', {
      value: domain.attrDomainEndpoint,
      exportName: 'EsDomainEndpoint',
    });
  }
}
