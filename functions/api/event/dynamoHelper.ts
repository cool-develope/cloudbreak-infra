class DynamoHelper {
  private readonly db: any;
  private readonly tableName: string;

  constructor(db: any, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  getUpdateExpression(attributes: any = {}) {
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

  updateItem(pk: string, sk: string, attributes: any) {
    const { expression, names, values } = this.getUpdateExpression(attributes);

    const params = {
      TableName: this.tableName,
      Key: { pk, sk },
      UpdateExpression: 'SET ' + expression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    };

    return this.db.update(params).promise();
  }

  queryItems(pk: string, sk: string) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk and begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':sk': sk,
      },
    };

    return this.db.query(params).promise();
  }

  queryItemsByIndex(sk: string, pk: string, indexName: string) {
    const params = {
      TableName: this.tableName,
      IndexName: indexName,
      KeyConditionExpression: 'sk = :sk and begins_with(pk, :pk)',
      ExpressionAttributeValues: {
        ':sk': sk,
        ':pk': pk,
      },
    };

    return this.db.query(params).promise();
  }

  getItem(pk: string, sk: string) {
    const params = {
      TableName: this.tableName,
      Key: { pk, sk },
    };

    return this.db.get(params).promise();
  }

  getUniqItemsFromArray(arrayOfKeys: { pk: string; sk: string }[]) {
    const keys = new Set<{ pk: string; sk: string }>(arrayOfKeys);
    return [...keys];
  }

  async batchGet(
    arrayOfKeys: { pk: string; sk: string }[],
    idField: string,
    getType: (data: any) => any = (data) => data,
  ): Promise<Map<string, any>> {
    const keys = this.getUniqItemsFromArray(arrayOfKeys);

    /**
     * Split items by batch max size (25)
     */
    const batchLimit = 25;
    const batchParams = [];
    while (keys.length) {
      const portionOfPutRequests = keys.splice(0, batchLimit);
      batchParams.push({
        RequestItems: {
          [this.tableName]: {
            Keys: portionOfPutRequests,
          },
        },
      });
    }

    /**
     * Run all batchGet in parallel by portions
     */
    const arrayOfGet = batchParams.map((params) => this.db.batchGet(params).promise());
    const res = await Promise.all(arrayOfGet);

    const result = new Map();

    const arrayOfItems = res.map((resItem) => resItem.Responses[this.tableName]);
    for (const items of arrayOfItems) {
      for (const item of items) {
        result.set(item[idField], getType(item));
      }
    }

    return result;
  }
}

export default DynamoHelper;
