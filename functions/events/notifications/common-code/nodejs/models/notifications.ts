import DynamoHelper from '../dynamoHelper';
import {
  Notification,
  NotificationRecord,
  NotificationsConnection,
  NotificationInput,
  NotificationType,
  KeyValue,
} from '../types/notifications';

class NotificationsModel {
  private readonly es: any;
  private readonly db: any;
  private readonly tableName: string;
  private readonly dynamoHelper: DynamoHelper;
  private readonly imagesDomain: string;
  private readonly uuidv4: () => string;

  constructor(db: any, tableName: string, imagesDomain: string, uuidv4: () => string, es: any) {
    this.es = es;
    this.db = db;
    this.tableName = tableName;
    this.imagesDomain = imagesDomain;
    this.dynamoHelper = new DynamoHelper(this.db, this.tableName);
    this.uuidv4 = uuidv4;
  }

  async create(userId: string, input: NotificationInput): Promise<void> {
    const { type, attributes } = input;

    const pk = `user#${userId}`;
    const sk = `notification#${this.uuidv4()}`;

    const metadata: NotificationRecord = {
      type,
      attributes,
      createdAt: new Date().toISOString(),
    };

    console.log('Create notification', { type, userId, sk });
    await this.dynamoHelper.updateItem(pk, sk, metadata);
  }

  async list(userId: string, limit: number = 10): Promise<NotificationsConnection> {
    const { Items } = await this.dynamoHelper.queryItems(`user#${userId}`, 'notification#');
    const items: Notification[] = Items.map(
      ({ sk, type, attributes, createdAt }: NotificationRecord) => ({
        id: sk?.replace('tification#', ''),
        type,
        attributes,
        createDate: createdAt,
      }),
    );

    return {
      items,
    };
  }

  private isAttributesEqual(attr1: KeyValue, attr2: KeyValue) {
    return attr1.Key === attr2.Key && attr1.Value == attr2.Value;
  }

  private isAttributesIncludes(attributes: KeyValue[], testValues: KeyValue[]) {
    return testValues.every((attr1) =>
      attributes.find((attr2) => this.isAttributesEqual(attr1, attr2)),
    );
  }

  private async getUserNotifications(userId: string, type: NotificationType) {
    const pk = `user#${userId}`;
    const sk = 'notification#';
    const { Items }: { Items?: any[] | null } = await this.dynamoHelper.queryItems(pk, sk);

    if (Items) {
      return Items.filter((row: any) => row.type === type);
    }

    return [];
  }

  async delete(userId: string, type: NotificationType, attributes: KeyValue[]) {
    const notifications = await this.getUserNotifications(userId, type);

    console.log(
      `Trying to delete notification ${type} for ${userId}`,
      JSON.stringify(attributes, null, 2),
    );

    for (const item of notifications) {
      const isMatched = this.isAttributesIncludes(item.attributes, attributes);

      if (isMatched) {
        console.log(
          JSON.stringify(
            {
              action: 'Notification.delete',
              userId,
              type,
              attributes,
              item,
            },
            null,
            2,
          ),
        );
        await this.dynamoHelper.deleteItem(item.pk, item.sk);
      }
    }
  }
}

export default NotificationsModel;
