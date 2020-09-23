export enum FieldName {
  createCompanyPrivate = 'createCompanyPrivate',
  updateCompanyPrivate = 'updateCompanyPrivate',
  companyPrivate = 'companyPrivate',
}

export interface CompanyRecord {
  pk?: string;
  sk?: string;
  name?: string;
  country?: string;
  legalForm?: string;
  regDate?: string;
  regNumber?: string;
  vatNumber?: string;
  legalSector?: string;
  goals?: string;
  address?: Address;
  addressOffice?: Address | null;
  representativeFiles?: string[];
  owners?: CompanyOwner[] | null;
  ownerUserId?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface Company {
  id: string;
  name: string;
  country: string;
  legalForm: string;
  legalSector: string;
  regDate: string;
  regNumber: string;
  vatNumber: string;
  goals: string;
  address: Address;
  addressOffice: Address | null;
  representativeFiles: string[] | null;
  owners: CompanyOwner[] | null;
}

export interface UpdateCompanyPrivateInput {
  name: string;
  country: string;
  legalForm: string;
  legalSector: string;
  regDate: string;
  regNumber: string;
  vatNumber: string;
  goals: string;
  address: Address;
  addressOffice: Address;
  representativeFiles: string[];
  owners: CompanyOwner[];
}

export interface Address {
  city: string;
  postcode: string;
  address1: string;
  address2: string;
}

export interface CompanyOwner {
  firstName: string;
  lastName: string;
  email: string;
}

export interface UpdateCompanyPrivatePayload {
  errors: string[];
  company: Company;
}

export interface FunctionEvent {
  arguments: {
    input: UpdateCompanyPrivateInput;
  };
  identity: { sub: string };
  info: { fieldName: string };
}
