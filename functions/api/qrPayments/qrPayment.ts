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
  CognitoIdentity,
} from './types';
import QrFile from './qrFile';

export default class QrPayments {
  private readonly dynamoHelper: DynamoHelper;
  private readonly qrFile: QrFile;

  constructor(
    private readonly region: string,
    private readonly tableName: string | undefined,
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

  private getTypeQrPayment(item: QrPaymentDBItem): QrPayment {
    // TODO: club
    // TODO: category
    // TODO: createdBy
    // TODO: transactions

    return {
      id: item.sk.replace('qr-payment#', ''),
      club: null,
      category: null,
      createdBy: null,
      amount: item.amount,
      description: item.description,
      images: item.images,
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
    const qrS3Key = await this.qrFile.createQR(input.clubId, paymentId, `Pay for ${paymentId}`);
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
    const payment = this.getTypeQrPayment(item as QrPaymentDBItem);

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
    return this.getTypeQrPayment(item as QrPaymentDBItem);
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
    const items = queryResult.map((item) => this.getTypeQrPayment(item as QrPaymentDBItem));
    return { items };
  }
}
