// @ts-ignore
import * as AWS from 'aws-sdk';
import { EventBridgeHandler } from 'aws-lambda';
// @ts-ignore
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

const cognito = new AWS.CognitoIdentityServiceProvider();
const { TREEZOR_BASE_URL = '', TREEZOR_CLIENT_ID = '', TREEZOR_CLIENT_SECRET = '' } = process.env;

const updateUserAttributes = ({
  userPoolId,
  sub,
  trzUserId,
}: {
  userPoolId: string;
  sub: string;
  trzUserId: string;
}) => {
  const params = {
    UserAttributes: [
      {
        Name: 'custom:trzUserId',
        Value: trzUserId,
      },
      {
        Name: 'custom:trzScopes',
        Value: 'read,write',
      },
    ],
    UserPoolId: userPoolId,
    Username: sub,
  };

  return cognito.adminUpdateUserAttributes(params).promise();
};

const getTreezorToken = async () => {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', TREEZOR_CLIENT_ID);
  params.append('client_secret', TREEZOR_CLIENT_SECRET);
  params.append('scope', 'read_write');

  const res = await fetch(`${TREEZOR_BASE_URL}/oauth/token`, {
    method: 'POST',
    body: params,
  });

  const { access_token } = await res.json();
  return access_token;
};

const createTreezorUser = async ({
  email,
  treezorToken,
  specifiedUSPerson,
  userTypeId,
}: {
  email: string;
  treezorToken: string;
  specifiedUSPerson: boolean;
  userTypeId: string;
}) => {
  const params = new URLSearchParams();
  params.append('specifiedUSPerson', specifiedUSPerson ? '1' : '0');
  params.append('email', email);
  params.append('userTypeId', userTypeId);

  try {
    const res = await fetch(`${TREEZOR_BASE_URL}/v1/users`, {
      method: 'POST',
      body: params,
      headers: { Authorization: `Bearer ${treezorToken}` },
    });

    const resJson = await res.json();
    console.log('Treezor User:', resJson);
  } catch (err) {
    console.log('Error on create user:', err);
  }
};

export const handler: EventBridgeHandler<any, any, any> = async (event) => {
  const {
    detail: {
      userPoolId,
      userAttributes: { sub, email },
    },
  } = event;

  /**
   * 1. Get token to access Treezor Connect API
   */
  const treezorToken = await getTreezorToken();

  /**
   * 2. Create Treezor Connect User
   */
  await createTreezorUser({
    email: `${Date.now()}@test.com`,
    treezorToken,
    specifiedUSPerson: false,
    userTypeId: '1',
  });

  // VALUE	TYPE
  // 1	Natural person (default)
  // 2	Business entity
  // 3	Non - governmental organization
  // 4	Governmental organization

  /**
   * 3. Update Cognito User
   */
  // await updateUserAttributes({
  //   userPoolId,
  //   sub,
  //   trzUserId,
  // });
};
