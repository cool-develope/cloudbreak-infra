// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import {
  CreateQrPaymentCategoryInput,
  CreateQrPaymentCategoryPayload,
  UpdateQrPaymentCategoryInput,
  UpdateQrPaymentCategoryPayload,
  DeleteQrPaymentCategoryInput,
  DeleteQrPaymentCategoryPayload,
  QrPaymentCategoryDBItem,
  QrPaymentCategory,
  CognitoIdentity,
  EventBatchQrPayment,
} from './types';
import { DynamoHelper } from '../../shared-code';

export default class QrPaymentCategories {
  private readonly dynamoHelper: DynamoHelper;

  constructor(private readonly region: string, private readonly tableName: string) {
    this.dynamoHelper = new DynamoHelper(this.region, this.tableName);
  }

  private getTypeQrPaymentCategory(item: QrPaymentCategoryDBItem): QrPaymentCategory {
    return {
      id: item.sk.replace('qr-payment-category#', ''),
      name: item.name,
      image: item.image,
      vatFee: item.vatFee,
    };
  }

  public async create(
    identity: CognitoIdentity,
    input: CreateQrPaymentCategoryInput,
  ): Promise<CreateQrPaymentCategoryPayload> {
    /**
     * TODO: ACL
     */

    const pk = `club#${input.clubId}`;
    const sk = `qr-payment-category#${uuidv4()}`;
    const attributes: Partial<QrPaymentCategoryDBItem> = {
      name: input.name,
      image: input.image,
      vatFee: input.vatFee,
      createdAt: new Date().toISOString(),
    };
    const item = await this.dynamoHelper.updateItem(pk, sk, attributes);
    return {
      errors: [],
      category: this.getTypeQrPaymentCategory(item as QrPaymentCategoryDBItem),
    };
  }

  public async update(
    identity: CognitoIdentity,
    input: UpdateQrPaymentCategoryInput,
  ): Promise<UpdateQrPaymentCategoryPayload> {
    /**
     * TODO: ACL
     */

    const pk = `club#${input.clubId}`;
    const sk = `qr-payment-category#${input.id}`;
    const attributes: Partial<QrPaymentCategoryDBItem> = {
      name: input.name,
      image: input.image,
      modifiedAt: new Date().toISOString(),
    };
    const item = await this.dynamoHelper.updateItem(pk, sk, attributes);
    return {
      errors: [],
      category: this.getTypeQrPaymentCategory(item as QrPaymentCategoryDBItem),
    };
  }

  public async delete(
    identity: CognitoIdentity,
    input: DeleteQrPaymentCategoryInput,
  ): Promise<DeleteQrPaymentCategoryPayload> {
    /**
     * TODO: ACL
     * TODO: Clean up
     * - Remove categoryId from each QrPayment
     * - Disallow delete if QrPayment exists
     * - Archive category
     */

    const pk = `club#${input.clubId}`;
    const sk = `qr-payment-category#${input.id}`;
    await this.dynamoHelper.deleteItem(pk, sk);
    return {
      errors: [],
    };
  }

  public async list(clubId: string): Promise<QrPaymentCategory[]> {
    const pk = `club#${clubId}`;
    const sk = 'qr-payment-category#';
    const items = await this.dynamoHelper.query({ pk, sk });
    return items.map((item) => this.getTypeQrPaymentCategory(item as QrPaymentCategoryDBItem));
  }

  private async getCategoriesByKeys(
    arrayOfKeys: { pk: string; sk: string }[],
  ): Promise<Map<string, QrPaymentCategory>> {
    const result = await this.dynamoHelper.batchGet(arrayOfKeys, 'sk', (item) =>
      this.getTypeQrPaymentCategory(item),
    );
    return result;
  }

  public async batchCategory(
    event: EventBatchQrPayment[],
  ): Promise<(QrPaymentCategory | undefined)[]> {
    const ids = event.map((item) => item.source.category?.id);
    const uniqCategories = [...new Set(...ids)];
    const arrayOfKeys = uniqCategories.map((id) => ({
      pk: `club#${event[0].source.club?.id}`,
      sk: `qr-payment-category#${id}`,
    }));

    const categories = await this.getCategoriesByKeys(arrayOfKeys);

    const result = event.map((item) => {
      const sk = `qr-payment-category#${item.source.category?.id}`;
      return categories.get(sk);
    });

    return result;
  }
}
