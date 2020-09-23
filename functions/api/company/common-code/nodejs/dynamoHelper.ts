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

  getItem(pk: string, sk: string) {
    const params = {
      TableName: this.tableName,
      Key: { pk, sk },
    };

    return this.db.get(params).promise();
  }
}

export default DynamoHelper;
