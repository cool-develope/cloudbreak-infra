// @ts-ignore
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

export enum TreezorUserStatus {
  PENDING = 'PENDING',
  CANCELED = 'CANCELED',
  VALIDATED = 'VALIDATED',
}

export enum TreezorUserKycLevel {
  NONE = 0,
  LIGHT = 1,
  REGULAR = 2,
  REFUSED = 4,
}

export enum TreezorUserKycReview {
  NONE = 0,
  PENDING = 1,
  VALIDATED = 2,
  REFUSED = 3,
}

export interface TreezorUser {
  userId?: number;
  userTypeId?: TreezorUserType;
  userStatus?: TreezorUserStatus;
  userTag?: string;
  parentUserId?: number;
  parentType?: string;
  controllingPersonType?: number;
  employeeType?: number;
  specifiedUSPerson?: number;
  title?: string;
  firstname?: string;
  lastname?: string;
  middleNames?: string;
  birthday?: string;
  email?: string;
  address1?: string;
  address2?: string;
  postcode?: string;
  city?: string;
  state?: string;
  country?: string;
  countryName?: string;
  phone?: string;
  mobile?: string;
  nationality?: string;
  nationalityOther?: string;
  placeOfBirth?: string;
  birthCountry?: string;
  occupation?: string;
  incomeRange?: string;
  legalName?: string;
  legalNameEmbossed?: string;
  legalRegistrationNumber?: string;
  legalTvaNumber?: string;
  legalRegistrationDate?: string;
  legalForm?: string;
  legalShareCapital?: number;
  legalSector?: string;
  legalAnnualTurnOver?: string;
  legalNetIncomeRange?: string;
  legalNumberOfEmployeeRange?: string;
  effectiveBeneficiary?: number;
  kycLevel?: TreezorUserKycLevel;
  kycReview?: TreezorUserKycReview;
  kycReviewComment?: string;
  isFreezed?: number;
  language?: string;
  optInMailing?: number | null;
  sepaCreditorIdentifier?: string;
  taxNumber?: string;
  taxResidence?: string;
  position?: string;
  personalAssets?: string;
  createdDate?: string;
  modifiedDate?: string;
  walletCount?: number;
  payinCount?: number;
  totalRows?: string;
}

export enum TreezorUserType {
  NaturalPerson = 1,
  BusinessEntity = 2,
  NonGovernmentalOrganization = 3,
  GovernmentalOrganization = 4,
}

class TreezorClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(baseUrl: string, clientId: string, clientSecret: string) {
    this.baseUrl = baseUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  objToURLSearchParams(obj: any = {}) {
    const params = new URLSearchParams();
    for (const key in obj) {
      params.append(key, String(obj[key]));
    }
    return params;
  }

  async createUser(
    userData: TreezorUser,
  ): Promise<{ user: TreezorUser | null; error: string | null }> {
    userData.incomeRange = '0-18';
    userData.legalNetIncomeRange = '0-4';
    userData.legalNumberOfEmployeeRange = '0';
    userData.legalAnnualTurnOver = '0-39';
    userData.title = 'M';
    userData.nationality = userData.country;
    
    console.log('Treezor user data', userData);

    const treezorToken = await this.getTreezorToken();
    const params = this.objToURLSearchParams(userData);

    try {
      const res = await fetch(`${this.baseUrl}/v1/users`, {
        method: 'POST',
        body: params,
        headers: { Authorization: `Bearer ${treezorToken}` },
      });

      const result = await res.json();

      if (result && result.users && result.users.length) {
        const treezorUser = result.users[0] as TreezorUser;
        return {
          user: treezorUser,
          error: null,
        };
      } else {
        console.log('EMPTY createUser', {
          userData,
          result: JSON.stringify(result, null, 2),
        });
        return {
          user: null,
          error: result.errors.map((e: any) => e.message).join('. '),
        };
      }
    } catch (err) {
      console.log('ERROR createUser', {
        params,
        err: JSON.stringify(err, null, 2),
      });
      return {
        user: null,
        error: err.message,
      };
    }
  }

  private async getTreezorToken(): Promise<string | null> {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('scope', 'read_write admin');

    try {
      const res = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        body: params,
      });

      const { access_token } = await res.json();
      return access_token;
    } catch (err) {
      console.log('ERROR getTreezorToken', {
        params,
        err,
      });
      return null;
    }
  }
}

export default TreezorClient;
