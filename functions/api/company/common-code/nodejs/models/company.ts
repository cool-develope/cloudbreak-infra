import DynamoHelper from '../dynamoHelper';
import {
  UpdateCompanyPrivateInput,
  UpdateCompanyPrivatePayload,
  Company,
  CompanyRecord,
} from '../types/comp';

class CompanyModel {
  private readonly db: any;
  private readonly tableName: string;
  private readonly dynamoHelper: DynamoHelper;
  private readonly imagesDomain: string;
  private readonly uuidv4: () => string;

  constructor(db: any, tableName: string, imagesDomain: string, uuidv4: () => string) {
    this.db = db;
    this.tableName = tableName;
    this.imagesDomain = imagesDomain;
    this.dynamoHelper = new DynamoHelper(this.db, this.tableName);
    this.uuidv4 = uuidv4;
  }

  async create(
    userId: string,
    input: UpdateCompanyPrivateInput,
  ): Promise<UpdateCompanyPrivatePayload> {
    const result = await this.update(userId, input);

    const companyId = result.company.id;
    await this.dynamoHelper.updateItem(`user#${userId}`, 'metadata', { companyId });

    return result;
  }

  async update(
    userId: string,
    input: UpdateCompanyPrivateInput,
  ): Promise<UpdateCompanyPrivatePayload> {
    const {
      name,
      country,
      legalForm,
      legalSector,
      regDate,
      regNumber,
      vatNumber,
      goals,
      address,
      addressOffice,
      representativeFiles,
      owners,
    } = input;

    const {
      Item: { companyId },
    } = await this.dynamoHelper.getItem(`user#${userId}`, 'metadata');

    const pk = companyId ? `company#${companyId}` : `company#${this.uuidv4()}`;
    const defaultValues = companyId ? null : this.getDefaultValues(userId);

    const metadata: CompanyRecord = {
      ...defaultValues,
      name,
      country,
      legalForm,
      legalSector,
      regDate,
      regNumber,
      vatNumber,
      goals,
      address,
      addressOffice,
      representativeFiles,
      owners,
      modifiedAt: new Date().toISOString(),
    };

    const { Attributes } = await this.dynamoHelper.updateItem(pk, 'metadata', metadata);

    return {
      errors: [],
      company: this.getTypeCompany(Attributes),
    };
  }

  async getByUserId(userId: string): Promise<Company | null> {
    const {
      Item: { companyId },
    } = await this.dynamoHelper.getItem(`user#${userId}`, 'metadata');

    if (!companyId) {
      return null;
    }

    const { Item } = await this.dynamoHelper.getItem(`company#${companyId}`, 'metadata');
    return this.getTypeCompany(Item);
  }

  getTypeCompany({
    pk = '',
    name = '',
    country = '',
    legalForm = '',
    legalSector = '',
    regDate = '',
    regNumber = '',
    vatNumber = '',
    goals = '',
    address = {
      city: '',
      postcode: '',
      address1: '',
      address2: '',
    },
    addressOffice = null,
    representativeFiles = [],
    owners = null,
  }: CompanyRecord): Company {
    return {
      id: pk.replace('company#', ''),
      name,
      country,
      legalForm,
      legalSector,
      regDate,
      regNumber,
      vatNumber,
      goals,
      address,
      addressOffice,
      representativeFiles,
      owners,
    };
  }

  getDefaultValues(userId: string) {
    return {
      ownerUserId: userId,
      createdAt: new Date().toISOString(),
    };
  }
}

export default CompanyModel;
