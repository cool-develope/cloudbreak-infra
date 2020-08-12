import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';

export interface TableStackProps extends cdk.StackProps {
  dictionaryTableName: string;
  usersTableName: string;
}

export class TableStack extends cdk.Stack {
  public readonly dictionaryTable: dynamodb.Table;

  constructor(scope: cdk.Construct, id: string, props: TableStackProps) {
    super(scope, id, props);

    const { dictionaryTableName, usersTableName } = props;

    /**
     * Dictionary
     */
    this.dictionaryTable = new dynamodb.Table(this, 'DictionaryTable', {
      tableName: dictionaryTableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    /**
     * Users
     */
    this.dictionaryTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: usersTableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });
  }
}
