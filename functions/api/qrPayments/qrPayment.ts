// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import { DynamoHelper } from '../../shared-code';
import {
  CreateQrPaymentInput,
  DeleteQrPaymentInput,
  CreateQrPaymentPayload,
  DeleteQrPaymentPayload,
  QrPaymentsConnection,
  QrPaymentsFilterInput,
  QrPayment,
  QrCode,
  QrPaymentDBItem,
  QrPaymentTransaction,
  QrPaymentTransactionDBItem,
  CognitoIdentity,
  EventBatchQrPayment,
  ClubShort,
  UserPublic,
  Image,
} from './types';
import QrFile from './qrFile';

export default class QrPayments {
  private readonly dynamoHelper: DynamoHelper;
  private readonly qrFile: QrFile;

  constructor(
    private readonly region: string,
    private readonly tableName: string,
    private readonly bucketName: string,
    private readonly imagesDomain: string,
  ) {
    this.dynamoHelper = new DynamoHelper(this.region, this.tableName);
    this.qrFile = new QrFile(this.region, this.bucketName);
  }

  getTypeQrCode(s3Key: string = ''): QrCode {
    return {
      url: s3Key ? `https://${this.imagesDomain}/${s3Key}` : '',
    };
  }

  getTypeImage(s3Key: string = ''): Image {
    return {
      url: s3Key ? `https://${this.imagesDomain}/${s3Key}` : '',
    };
  }

  private async getClubShort(clubId: string): Promise<ClubShort> {
    const item = await this.dynamoHelper.getItem(`club#${clubId}`, 'metadata');
    return {
      id: clubId,
      name: item?.name,
      logo: this.getTypeImage(item?.logo),
    };
  }

  private async getUserPublic(userId: string): Promise<UserPublic> {
    const item = await this.dynamoHelper.getItem(`user#${userId}`, 'metadata');
    return {
      id: userId,
      firstName: item?.firstName,
      lastName: item?.lastName,
      photo: this.getTypeImage(item?.photo),
    };
  }

  private async getTypeQrPayment(item: QrPaymentDBItem): Promise<QrPayment> {
    const clubId = item.pk.replace('club#', '');
    const id = item.sk.replace('qr-payment#', '');
    const createdBy = await this.getUserPublic(item.createdByUser);
    const club = await this.getClubShort(clubId);

    return {
      id,
      club,
      category: {
        id: item.categoryId,
      },
      createdBy,
      transactions: [],
      amount: item.amount,
      description: item.description,
      images: item.images.map((s3Key) => this.getTypeImage(s3Key)),
      qrCode: this.getTypeQrCode(item.qrCode),
      createDate: item.createdAt,
    };
  }

  public async create(
    identity: CognitoIdentity,
    input: CreateQrPaymentInput,
  ): Promise<CreateQrPaymentPayload> {
    /**
     * TODO: ACL
     */

    const paymentId = uuidv4();
    const qrText = `qr-payment:${paymentId},club:${input.clubId}`;
    const qrS3Key = await this.qrFile.createQR(input.clubId, paymentId, qrText);
    const pk = `club#${input.clubId}`;
    const sk = `qr-payment#${paymentId}`;

    const attributes: Partial<QrPaymentDBItem> = {
      categoryId: input.categoryId,
      amount: input.amount,
      description: input.description,
      images: input.images,
      qrCode: qrS3Key,
      createdByUser: identity.sub,
      createdAt: new Date().toISOString(),
    };

    const item = await this.dynamoHelper.updateItem(pk, sk, attributes);
    const payment = await this.getTypeQrPayment(item as QrPaymentDBItem);

    console.log({
      item,
      payment,
    });

    return {
      errors: [],
      payment,
    };
  }

  public async delete(
    identity: CognitoIdentity,
    input: DeleteQrPaymentInput,
  ): Promise<DeleteQrPaymentPayload> {
    /**
     * TODO: ACL
     * TODO: Clean up
     * - Disallow delete if payments exists
     * - Archive QrPayment
     */

    const { clubId, id } = input;
    const pk = `club#${clubId}`;
    const sk = `qr-payment#${id}`;
    await this.dynamoHelper.deleteItem(pk, sk);
    await this.qrFile.deleteQR(clubId, id);

    return {
      errors: [],
    };
  }

  public async retrieve(identity: CognitoIdentity, clubId: string, id: string): Promise<QrPayment> {
    const pk = `club#${clubId}`;
    const sk = `qr-payment#${id}`;

    const item = await this.dynamoHelper.getItem(pk, sk);
    return await this.getTypeQrPayment(item as QrPaymentDBItem);
  }

  public async list(
    identity: CognitoIdentity,
    filter: QrPaymentsFilterInput,
  ): Promise<QrPaymentsConnection> {
    const pk = `club#${filter.clubId}`;
    const sk = 'qr-payment#';

    const filterExpression = filter.categoryId ? 'categoryId = :categoryId' : undefined;
    const filterValues = filter.categoryId
      ? {
          ':categoryId': filter.categoryId,
        }
      : undefined;

    const queryResult = await this.dynamoHelper.query({
      pk,
      sk,
      filterExpression,
      filterValues,
    });
    const arrayOfPromises = queryResult.map((item) =>
      this.getTypeQrPayment(item as QrPaymentDBItem),
    );
    const items = await Promise.all(arrayOfPromises);
    return { items };
  }

  private async getTypeTransaction(
    item: QrPaymentTransactionDBItem,
  ): Promise<QrPaymentTransaction> {
    const qrId = item.pk.replace('qr-payment#', '');
    const userId = item.sk.replace('user#', '');
    const user = await this.getUserPublic(userId);

    return {
      user,
      transferId: item.treezorTransferId,
      createDate: item.createdAt,
    };
  }

  public async getTransactions(qrId: string): Promise<QrPaymentTransaction[]> {
    const queryResult = await this.dynamoHelper.query({
      pk: `qr-payment#${qrId}`,
      sk: 'user#',
    });

    const arrayOfPromises = queryResult.map((item) =>
      this.getTypeTransaction(item as QrPaymentTransactionDBItem),
    );
    const items = await Promise.all(arrayOfPromises);
    return items;
  }

  public async batchTransactions(event: EventBatchQrPayment[]): Promise<QrPaymentTransaction[][]> {
    const ids = event.map((item) => item.source.id);
    const queries = ids.map((id) => this.getTransactions(id));
    const result: QrPaymentTransaction[][] = await Promise.all(queries);
    return result;
  }
}
