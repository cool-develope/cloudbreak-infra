class DynamoHelper {
  private readonly db: any;
  private readonly tableName: string;

  constructor(db: any, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  getUpdateExpression(attributes: any = {}) {
    return Object.keys(attributes)
      .map((key) =>
        attributes[key] !== undefined && attributes[key] !== null ? `${key} = :${key}` : null,
      )
      .filter((attr) => !!attr)
      .join(', ');
  }

  getExpressionAttributeValues(attributes = {}) {
    const obj: any = {};
    Object.entries(attributes).forEach(([key, value]) =>
      value !== undefined && value !== null ? (obj[`:${key}`] = value) : null,
    );
    return obj;
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

  updateItem(pk: string, sk: string, attributes: any) {
    const condition = 'SET ' + this.getUpdateExpression(attributes);
    const values = this.getExpressionAttributeValues(attributes);

    const params = {
      TableName: this.tableName,
      Key: { pk, sk },
      UpdateExpression: condition,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    };

    return this.db.update(params).promise();
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
