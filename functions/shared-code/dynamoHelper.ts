import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export interface QueryProps {
  pk: string;
  sk: string;
  keyConditionExpression?: string;
  indexName?: 'GSI1';
  filterExpression?: string;
  filterValues?: {
    [key: string]: string | number | boolean;
  };
}

export default class DynamoHelper {
  private readonly db: DynamoDBClient;

  constructor(private readonly region: string, private readonly tableName: string | undefined) {
    this.db = new DynamoDBClient({ region: this.region });
  }

  private getUpdateExpression(attributes: any = {}) {
    const keys = Object.keys(attributes).filter(
      (key) => attributes[key] !== undefined && attributes[key] !== null,
    );
    const expression = keys.map((key) => `#${key} = :${key}`).join(', ');

    const values: any = {};
    const names: any = {};

    keys.forEach((key) => {
      values[`:${key}`] = attributes[key];
      names[`#${key}`] = key;
    });

    return {
      expression,
      names,
      values,
    };
  }

  async updateItem(pk: string, sk: string, attributes: any) {
    const { expression, names, values } = this.getUpdateExpression(attributes);

    const params = {
      TableName: this.tableName,
      Key: marshall({ pk, sk }),
      UpdateExpression: 'SET ' + expression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: marshall(values),
      ReturnValues: 'ALL_NEW',
    };

    const response = await this.db.send(new UpdateItemCommand(params));
    return response.Attributes ? unmarshall(response.Attributes) : undefined;
  }

  async query({
    pk,
    sk,
    keyConditionExpression,
    indexName,
    filterExpression,
    filterValues,
  }: QueryProps) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: keyConditionExpression || 'pk = :pk and begins_with(sk, :sk)',
      IndexName: indexName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: marshall({
        ':pk': pk,
        ':sk': sk,
        ...filterValues,
      }),
    };

    const response = await this.db.send(new QueryCommand(params));
    return response.Items ? response.Items.map((x) => unmarshall(x)) : [];
  }

  async getItem(pk: string, sk: string) {
    const params = {
      TableName: this.tableName,
      Key: marshall({ pk, sk }),
    };

    const response = await this.db.send(new GetItemCommand(params));
    return response.Item ? unmarshall(response.Item) : undefined;
  }

  async deleteItem(pk: string, sk: string) {
    const params = {
      TableName: this.tableName,
      Key: marshall({ pk, sk }),
    };

    await this.db.send(new DeleteItemCommand(params));
  }
}
