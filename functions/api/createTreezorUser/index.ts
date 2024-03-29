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

const updateUser = async (userId: string, input: any) => {
  input.modifiedAt = new Date().toISOString();
  const { Attributes } = await dynamoHelper.updateItem(`user#${userId}`, 'metadata', input);
};

const getUser = async (userId: string) => {
  const { Item } = await dynamoHelper.getItem(`user#${userId}`, 'metadata', true);
  Item.id = Item.pk.replace('user#', '');
  return Item;
};

const isChild = async (userId: string, childUserId: string) => {
  const pk = `user#${childUserId}`;
  const sk = 'metadata';
  const { Item } = await dynamoHelper.getItem(pk, sk);
  return Item?.parentUserId === userId;
};

const getTreezorUserData = async (user: any): Promise<TreezorUser> => {
  const treezorUser: TreezorUser = {
    userTypeId: TreezorUserType.NaturalPerson,
    firstname: user.firstName,
    lastname: user.lastName,
    birthday: user.birthDate,
    email: user.email,
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

  /**
   * Case for child KYC by parent
   */
  if (user.phone) {
    treezorUser.phone = user.phone;
  }

  /**
   * Added parent data
   */
  if (user.parentUserId) {
    const parentUser = await getUser(user.parentUserId);
    if (parentUser?.treezorUserId) {
      treezorUser.parentUserId = parentUser.treezorUserId;
      treezorUser.controllingPersonType = 1;
      treezorUser.parentType = 'shareholder';
    }
  }

  return treezorUser;
};

const getTreezorCompanyData = (user: any, company: CompanyRecord): TreezorUser => {
  const treezorUser: TreezorUser = {
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

const setTreezorUserId = async (userId: string, treezorUserId: number | null) => {
  if (treezorUserId) {
    await Promise.all([
      updateUser(userId, { treezorUserId }),
      updateUserAttributes({
        userPoolId: COGNITO_USERPOOL_ID,
        sub: userId,
        trzUserId: String(treezorUserId),
        trzChildren: 'none',
        trzWalletsId: '0',
        trzCardsId: '0',
      }),
    ]);
  }
};

const getTreezorCreateUserData = async (
  field: FieldName,
  userId: string,
  input: any,
): Promise<TreezorUser> => {
  if (field === FieldName.createTreezorUser) {
    /**
     * Regular user
     */
    const { country, city, address1, address2, state, postcode, birthCity, usCitizen } = input;

    await updateUser(userId, {
      country,
      city,
      address1,
      address2,
      stateName: state,
      postcode,
      birthCity,
      usCitizen,
    });

    const user = await getUser(userId);
    return await getTreezorUserData(user);
  } else {
    /**
     * Business user
     */
    const user = await getUser(userId);
    const { companyId } = user;
    if (!companyId) {
      throw Error('The user should have a company');
    }

    const { Item: company } = await dynamoHelper.getItem(`company#${companyId}`, 'metadata');
    return getTreezorCompanyData(user, company);
  }
};

const getMyUserIdOrChild = async (sub: string, input: any, fieldName: string): Promise<string> => {
  if (input?.childUserId) {
    /**
     * My child
     */
    const { childUserId } = input;
    const isMyChild = await isChild(sub, childUserId);
    if (isMyChild) {
      console.log(`Parent called ${fieldName}`, {
        user: sub,
        child: childUserId,
        data: input,
      });
      return childUserId;
    } else {
      console.error('Access Denied', {
        action: fieldName,
        user: sub,
        target: childUserId,
      });
      throw Error('Access Denied ');
    }
  } else {
    /**
     * Me
     */
    return sub;
  }
};

export const handler: Handler = async (event) => {
  const {
    arguments: { input },
    identity: { sub },
    info: { fieldName },
  } = event;

  /**
   * User case:
   * - Adult
   * - Parent
   * - Child by Parent
   * - Business user
   */

  const field = fieldName as FieldName;
  const userId = await getMyUserIdOrChild(sub, input, fieldName);
  const data = await getTreezorCreateUserData(field, userId, input);
  const { user, error } = await treezorClient.createUser(data);
  const treezorUserId = user?.userId || null;
  await setTreezorUserId(userId, treezorUserId);

  return {
    errors: [error].filter((e) => !!e),
    treezorUserId,
  };
};
