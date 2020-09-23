// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import DynamoHelper from './dynamoHelper';
import TreezorClient, { TreezorUserType, TreezorUser } from './treezorClient';

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
  const { Item } = await dynamoHelper.getItem(pk, 'metadata');
  Item.id = Item.pk.replace('user#', '');
  return Item;
};

export const handler: Handler = async (event) => {
  const {
    arguments: {
      input: { country, city, address1, state, postcode, birthCity, usCitizen },
    },
    identity: { sub },
  } = event;

  const pk = `user#${sub}`;
  const user = await getUser(pk);
  const errors: string[] = [];
  let treezorUserId: number | null = null;

  console.log('user', user);

  /**
   * 1. Create Treezor Connect User
   */
  const treezorNewUserData: TreezorUser = {
    userTypeId: TreezorUserType.NaturalPerson,
    phone: user.phone,
    firstname: user.firstName,
    lastname: user.lastName,
    // birthday: user.birthDate,
    email: `${Date.now()}@test.com`,
    country,
    city,
    address1,
    state,
    postcode,
    placeOfBirth: birthCity,
    specifiedUSPerson: usCitizen ? 1 : 0,
  };

  if (user.parentUserId) {
    const parentUser = await getUser(`user#${user.parentUserId}`);
    if (parentUser?.treezorUserId) {
      treezorNewUserData.parentUserId = parentUser.treezorUserId;
    }
  }

  const treezorUser = await treezorClient.createUser(treezorNewUserData);

  if (treezorUser) {
    console.log('Treezor User', treezorUser);
    console.log('Treezor User', treezorUser?.firstname);

    treezorUserId = treezorUser?.userId || null;

    await updateUser(pk, {
      treezorUserId: treezorUserId,
      country,
      city,
      address1,
      stateName: state,
      postcode,
      birthCity,
      usCitizen,
    });

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
    errors.push('Error');
  }

  return {
    errors,
    treezorUserId,
  };
};
