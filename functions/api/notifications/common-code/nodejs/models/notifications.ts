import DynamoHelper from '../dynamoHelper';
import {
  Notification,
  NotificationRecord,
  NotificationsConnection,
  NotificationInput,
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
}

export default NotificationsModel;
