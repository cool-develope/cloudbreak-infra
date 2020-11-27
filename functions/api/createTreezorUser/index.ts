// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import DynamoHelper from './dynamoHelper';
import TreezorClient, { TreezorUserType, TreezorUser } from './treezorClient';

enum FieldName {
  createTreezorUser = 'createTreezorUser',
  createTreezorCompany = 'createTreezorCompany',
}

interface CompanyRecord {
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

interface Address {
  city: string;
  postcode: string;
  address1: string;
  address2: string;
}

interface CompanyOwner {
  firstName: string;
  lastName: string;
  email: string;
}

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN,
  COGNITO_USERPOOL_ID = '',
  TREEZOR_BASE_URL = '',
  TREEZOR_CLIENT_ID = '',
  TREEZOR_CLIENT_SECRET = '',
} = process.env;

const cognito = new AWS.CognitoIdentityServiceProvider();
const db = new AWS.DynamoDB.DocumentClient();
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);
const treezorClient = new TreezorClient(TREEZOR_BASE_URL, TREEZOR_CLIENT_ID, TREEZOR_CLIENT_SECRET);

const updateUserAttributes = ({
  userPoolId,
  sub,
  trzUserId,
  trzChildren,
  trzWalletsId,
  trzCardsId,
}: {
  userPoolId: string;
  sub: string;
  trzUserId: string;
  trzChildren: string;
  trzWalletsId: string;
  trzCardsId: string;
}) => {
  const params = {
    UserAttributes: [
      {
        Name: 'custom:trzUserId',
        Value: trzUserId,
      },
      {
        Name: 'custom:trzScopes',
        Value: 'read_write',
      },
      {
        Name: 'custom:trzChildren',
        Value: trzChildren,
      },
      {
        Name: 'custom:trzWalletsId',
        Value: trzWalletsId,
      },
      {
        Name: 'custom:trzCardsId',
        Value: trzCardsId,
      },
    ],
    UserPoolId: userPoolId,
    Username: sub,
  };

  return cognito.adminUpdateUserAttributes(params).promise();
};

const updateUser = async (pk: string, input: any) => {
  input.modifiedAt = new Date().toISOString();
  const { Attributes } = await dynamoHelper.updateItem(pk, 'metadata', input);
};

const getUser = async (pk: string) => {
  const { Item } = await dynamoHelper.getItem(pk, 'metadata', true);
  Item.id = Item.pk.replace('user#', '');
  return Item;
};

const getTreezorUserData = async (user: any): Promise<TreezorUser> => {
  const treezorUser: TreezorUser = {
    userTypeId: TreezorUserType.NaturalPerson,
    phone: user.phone,
    firstname: user.firstName,
    lastname: user.lastName,
    birthday: user.birthDate,
    email: `${Date.now()}@test.com`,
    country: user.country,
    city: user.city,
    address1: user.address1,
    address2: user.address2 || '',
    state: user.stateName,
    postcode: user.postcode,
    placeOfBirth: user.birthCity,
    birthCountry: user.birthCountry,
    specifiedUSPerson: user.usCitizen ? 1 : 0,
  };

  if (user.parentUserId) {
    const parentUser = await getUser(`user#${user.parentUserId}`);
    if (parentUser?.treezorUserId) {
      treezorUser.parentUserId = parentUser.treezorUserId;
    }
  }

  return treezorUser;
};

const getTreezorCompanyData = async (user: any, company: CompanyRecord): Promise<TreezorUser> => {
  const treezorUser: TreezorUser = {
    // TODO: remove random email
    userTypeId: TreezorUserType.BusinessEntity,
    phone: user.phone,
    firstname: user.firstName,
    lastname: user.lastName,
    birthday: user.birthDate,
    email: `${Date.now()}@test.com`,
    country: user.country,
    city: user.city,
    address1: user.address1,
    address2: user.address2 || '',
    state: user.stateName,
    postcode: user.postcode,
    placeOfBirth: user.birthCity,
    specifiedUSPerson: user.usCitizen ? 1 : 0,
    birthCountry: user.birthCountry,
    legalName: company.name,
    legalRegistrationNumber: company.regNumber,
    legalRegistrationDate: company.regDate,
    legalTvaNumber: company.vatNumber,
    legalForm: company.legalForm,
    legalSector: company.legalSector,
  };

  return treezorUser;
};

export const handler: Handler = async (event) => {
  const {
    arguments: { input },
    identity: { sub },
    info: { fieldName },
  } = event;

  /**
   * 1. Adult
   * 2. Parent
   * 3. Child
   * 4. Business user
   */

  const field = fieldName as FieldName;
  const pk = `user#${sub}`;
  const errors: string[] = [];
  let treezorUserId: number | null = null;
  let treezorNewUserData: TreezorUser | null = null;

  if (field === FieldName.createTreezorUser) {
    const { country, city, address1, address2, state, postcode, birthCity, usCitizen } = input;

    await updateUser(pk, {
      country,
      city,
      address1,
      address2,
      stateName: state,
      postcode,
      birthCity,
      usCitizen,
    });

    const user = await getUser(pk);
    treezorNewUserData = await getTreezorUserData(user);

    const { parentUserId } = user;
    if (parentUserId) {
      const parentUser = await getUser(`user#${parentUserId}`);
      if (parentUser && parentUser.treezorUserId) {
        treezorNewUserData.parentUserId = parentUser.treezorUserId;
        treezorNewUserData.controllingPersonType = 1;
        treezorNewUserData.parentType = 'shareholder';
      }
    }
  } else if (field === FieldName.createTreezorCompany) {
    const user = await getUser(pk);
    const { companyId } = user;
    if (!companyId) {
      throw Error('The user should have a company');
    }

    const { Item: company } = await dynamoHelper.getItem(`company#${companyId}`, 'metadata');
    treezorNewUserData = await getTreezorCompanyData(user, company);
  }

  /**
   * 1. Create Treezor Connect User
   */
  if (!treezorNewUserData) {
    throw Error('User data is empty');
  }

  treezorNewUserData.incomeRange = '0-18';
  treezorNewUserData.legalNetIncomeRange = '0-4';
  treezorNewUserData.legalNumberOfEmployeeRange = '0';
  treezorNewUserData.legalAnnualTurnOver = '0-39';
  treezorNewUserData.title = 'M';
  treezorNewUserData.nationality = treezorNewUserData.country;
  console.log('Treezor user data', treezorNewUserData);

  const { user: treezorUser, error } = await treezorClient.createUser(treezorNewUserData);

  if (treezorUser) {
    console.log('Treezor response', treezorUser);

    treezorUserId = treezorUser?.userId || null;
    await updateUser(pk, { treezorUserId });
    /**
     * 2. Update Cognito User
     */
    await updateUserAttributes({
      userPoolId: COGNITO_USERPOOL_ID,
      sub,
      trzUserId: String(treezorUserId),
      trzChildren: 'none',
      trzWalletsId: '0',
      trzCardsId: '0',
    });
  } else {
    errors.push(error || 'Error');
  }

  return {
    errors,
    treezorUserId,
  };
};
