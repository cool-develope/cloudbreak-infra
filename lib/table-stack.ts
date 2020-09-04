import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';

export interface TableStackProps extends cdk.StackProps {
  dictionaryTableName: string;
  mainTableName: string;
}

export class TableStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: TableStackProps) {
    super(scope, id, props);

    const { dictionaryTableName, mainTableName } = props;

    /**
     * Dictionary
     */
    const dictionaryTable = new dynamodb.Table(this, 'DictionaryTable', {
      tableName: dictionaryTableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    /**
     * Main
     */
    const mainTable = new dynamodb.Table(this, 'MainTable', {
      tableName: mainTableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });
  }
}
