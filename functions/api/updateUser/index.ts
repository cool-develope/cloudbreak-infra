// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import * as crypto from 'crypto';
import DynamoHelper from './dynamoHelper';
import {
  UpdateUserInput,
  User,
  Gender,
  Image,
  FieldName,
  UserChild,
  ChildInvitation,
  OrganizationType,
  KycReview,
  OrganizationRole,
  TeamMember,
  TeamUserRecord,
  TeamMemberType,
  TeamInvitationStatus,
  Organization,
  TreezorUser,
  SetPinPayload,
  VerifyPinPayload,
  ChangePinPayload,
} from './types';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN } = process.env;

const db = new AWS.DynamoDB.DocumentClient();
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);

const getUniqItemsFromArray = (arr: { pk: string; sk: string }[]) => {
  // TODO
  return arr;
};

const batchGet = async (
  arrayOfKeys: { pk: string; sk: string }[],
  idField: string,
  getType: (data: any) => any,
): Promise<Map<string, any>> => {
  const keys = getUniqItemsFromArray(arrayOfKeys);

  /**
   * Split items by batch max size (25)
   */
  const batchLimit = 25;
  const batchParams = [];
  while (keys.length) {
    const portionOfPutRequests = keys.splice(0, batchLimit);
    batchParams.push({
      RequestItems: {
        [MAIN_TABLE_NAME]: {
          Keys: portionOfPutRequests,
        },
      },
    });
  }

  /**
   * Run all batchWrite in parallel by portions
   */
  const arrayOfGet = batchParams.map((params) => db.batchGet(params).promise());
  const res = await Promise.all(arrayOfGet);

  const result = new Map();

  const arrayOfItems = res.map((resItem) => resItem.Responses[MAIN_TABLE_NAME]);
  for (const items of arrayOfItems) {
    for (const item of items) {
      result.set(item[idField], getType(item));
    }
  }

  return result;
};

const queryItemsByIndex = (sk: string, pk: string, indexName: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    IndexName: indexName,
    KeyConditionExpression: 'sk = :sk and begins_with(pk, :pk)',
    ExpressionAttributeValues: {
      ':sk': sk,
      ':pk': pk,
    },
  };

  return db.query(params).promise();
};

const queryItemsByIndexAndFilter = (
  sk: string,
  pk: string,
  indexName: string,
  ownerUserId: string,
) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    IndexName: indexName,
    KeyConditionExpression: 'sk = :sk and begins_with(pk, :pk)',
    FilterExpression: 'ownerUserId = :ownerUserId',
    ExpressionAttributeValues: {
      ':sk': sk,
      ':pk': pk,
      ':ownerUserId': ownerUserId,
    },
  };

  return db.query(params).promise();
};

const queryItems = (pk: string, sk: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    KeyConditionExpression: 'pk = :pk and begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': sk,
    },
  };

  return db.query(params).promise();
};

const getChildren = async ({ children }: { children: any }): Promise<UserChild[]> => {
  const childrenIds = (children && children.values) || [];
  const childrenData: UserChild[] = [];

  if (childrenIds && childrenIds.length) {
    const userKeys = childrenIds.map((userId: string) => ({
      pk: `user#${userId}`,
      sk: 'metadata',
    }));

    const users = await batchGet(userKeys, 'pk', getTypeUserChild);

    for (const userId of childrenIds) {
      childrenData.push(users.get(`user#${userId}`));
    }
  }

  return childrenData;
};

const getTeams = async (userId: string): Promise<TeamMember[]> => {
  const { Items } = await queryItemsByIndex(`user#${userId}`, 'team#', 'GSI1');
  const teams: TeamMember[] = Items.map(({ pk, clubId, role, status }: TeamUserRecord) => ({
    teamId: pk.replace('team#', ''),
    clubId,
    role,
    status,
  }));

  return teams;
};

const getOrganization = async (
  userId: string,
  teams: TeamMember[],
): Promise<Organization | null> => {
  const { Items } = await queryItemsByIndexAndFilter('metadata', 'club#', 'GSI1', userId);

  if (Items && Items.length) {
    /**
     * CLUB OWNER
     */
    const [club] = Items;

    return {
      type: OrganizationType.Club,
      role: OrganizationRole.Owner,
      id: club.pk.replace('club#', ''),
      name: club.name,
      logo: getTypeImage(club.logo),
    };
  } else {
    /**
     * CLUB COACH
     */
    const club = await getMyClub(teams);
    if (club) {
      return {
        type: OrganizationType.Club,
        role: OrganizationRole.Coach,
        id: club.pk.replace('club#', ''),
        name: club.name,
        logo: getTypeImage(club.logo),
      };
    }
  }

  return null;
};

const getMyClub = async (teams: TeamMember[]): Promise<any | null> => {
  const coachInTeam = teams.find((team) => team.role === TeamMemberType.Coach);

  if (coachInTeam) {
    const { clubId } = coachInTeam;
    const { Item: club } = await dynamoHelper.getItem(`club#${clubId}`, 'metadata');
    return club;
  }

  return null;
};

const getParent = async ({ parentUserId }: any): Promise<UserChild | null> => {
  if (parentUserId) {
    const { Item } = await dynamoHelper.getItem(`user#${parentUserId}`, 'metadata');
    return getTypeUserChild(Item);
  }

  return null;
};

const getPendingChildInvitations = async ({ email }: any): Promise<ChildInvitation[]> => {
  const pk = `invitation#${email}`;
  const { Items: invitations } = await queryItems(pk, 'child#');
  const pendingInvitations = invitations.filter((invite: any) => invite.inviteStatus === 'pending');

  if (pendingInvitations.length) {
    const userKeys = pendingInvitations.map(({ sk }: any) => ({
      pk: `user#${sk.replace('child#', '')}`,
      sk: 'metadata',
    }));
    const users = await batchGet(userKeys, 'pk', getTypeUserChild);

    return pendingInvitations.map((invite: any) => {
      const userId = invite.sk.replace('child#', '');
      const childInvitation: ChildInvitation = {
        invitationId: userId,
        createDate: invite.createdAt,
        user: users.get(`user#${userId}`),
      };

      return childInvitation;
    });
  }

  return [];
};

const getTypeUser = async (userData: any): Promise<User> => {
  const {
    pk,
    email = '',
    firstName = '',
    lastName = '',
    country,
    photo,
    phone,
    phoneCountry,
    birthDate,
    birthCountry,
    birthCity,
    gender,
    usCitizen,
    city,
    postcode,
    address1,
    address2,
    companyId,
    treezorUserId = null,
    treezorWalletId = null,
    kycReview = KycReview.NONE,
  } = userData;

  const userId = pk.replace('user#', '');

  // @ts-ignore
  const result = await Promise.allSettled([
    getChildren(userData),
    getParent(userData),
    getPendingChildInvitations(userData),
    getTeams(userId),
  ]);

  const [
    { value: children },
    { value: parent },
    { value: pendingChildInvitations },
    { value: teams = [] },
  ] = result;

  const organization = await getOrganization(userId, teams);

  const treezor: TreezorUser = {
    userId: treezorUserId,
    walletId: treezorWalletId,
  };

  return {
    id: userId,
    email,
    firstName,
    lastName,
    country,
    photo: getTypeImage(photo),
    phone,
    phoneCountry,
    birthDate,
    birthCountry,
    birthCity,
    gender,
    usCitizen,
    city,
    postcode,
    address1,
    address2,
    children,
    parent,
    pendingChildInvitations,
    organization,
    kycReview,
    treezor,
    teams,
  };
};

const getTypeUserChild = ({
  firstName = '',
  lastName = '',
  photo = '',
  email = '',
  birthDate = '',
  gender = '',
  phone = '',
  treezorUserId = '',
  treezorWalletId = '',
}: any) => ({
  firstName,
  lastName,
  photo: getTypeImage(photo),
  email,
  birthDate,
  gender,
  phone,
  treezor: {
    userId: treezorUserId,
    walletId: treezorWalletId,
  },
});

const getTypeImage = (photo: string = '') => ({
  url: photo ? `https://${IMAGES_DOMAIN}/${photo}` : '',
});

const updateUser = async (pk: string, input: UpdateUserInput) => {
  const { Attributes: userData } = await dynamoHelper.updateItem(pk, 'metadata', input);
  const user = await getTypeUser(userData);
  return user;
};

const generateSalt = (rounds: number) => {
  return crypto
    .randomBytes(Math.ceil(rounds / 2))
    .toString('hex')
    .slice(0, rounds);
};

const getHash = (pin: string, salt: string) => {
  return crypto.createHmac('sha256', salt).update(pin).digest('hex');
};

const compare = (pin: string, salt: string, hash: string) => {
  const newHash = getHash(pin, salt);

  if (hash && newHash === hash) {
    return true;
  }
  return false;
};

const setPin = async (
  sub: string,
  input: { pin: string },
  checkExists = true,
): Promise<SetPinPayload> => {
  const errors: string[] = [];
  const pk = `user#${sub}`;
  const sk = 'pin';
  const { Item } = await dynamoHelper.getItem(pk, sk);
  if (!input.pin || input.pin.length < 4) {
    errors.push('Pin is to short.');
  } else if (Item && checkExists) {
    errors.push('Pin is already set.');
  } else {
    const salt = generateSalt(12);
    const hash = getHash(input.pin, salt);
    await dynamoHelper.updateItem(pk, sk, {
      pin: hash,
      salt,
      modifiedAt: new Date().toISOString(),
    });
  }

  return {
    errors,
  };
};

const verifyPin = async (sub: string, input: { pin: string }): Promise<VerifyPinPayload> => {
  const errors: string[] = [];
  let verified = false;
  const pk = `user#${sub}`;
  const sk = 'pin';
  const { Item } = await dynamoHelper.getItem(pk, sk);
  if (Item) {
    const { pin, salt } = Item;
    verified = compare(input.pin, salt, pin);
  } else {
    errors.push('Pin is empty');
  }

  return {
    errors,
    verified,
  };
};

const changePin = async (
  sub: string,
  input: { currentPin: string; newPin: string },
): Promise<ChangePinPayload> => {
  const { currentPin, newPin } = input;
  const errors: string[] = [];

  const { verified } = await verifyPin(sub, { pin: currentPin });
  if (verified === true) {
    await setPin(sub, { pin: newPin }, false);
  } else {
    errors.push('Pin not verified');
  }

  return {
    errors,
  };
};

export const handler: Handler = async (event) => {
  const {
    arguments: { input = {} },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;
  const pk = `user#${sub}`;
  const sk = 'metadata';

  if (field === FieldName.updateUser) {
    /**
     * Mutation updateUser:
     */
    input.modifiedAt = new Date().toISOString();
    const user = await updateUser(pk, input);

    return {
      errors: [],
      user,
    };
  } else if (field === FieldName.me) {
    /**
     * Query me:
     */
    const { Item: userData } = await dynamoHelper.getItem(pk, sk);
    if (userData) {
      const user = await getTypeUser(userData);
      return user;
    } else {
      return null;
    }
  } else if (field === FieldName.setPin) {
    let checkExists = true;

    /**
     * If user don't start KYC,
     * allow to set PIN even if it exists
     */
    const { Item: userData } = await dynamoHelper.getItem(pk, sk);
    if (userData && !userData.kycReview) {
      checkExists = false;
    }

    return await setPin(sub, input, checkExists);
  } else if (field === FieldName.verifyPin) {
    return await verifyPin(sub, input);
  } else if (field === FieldName.changePin) {
    return await changePin(sub, input);
  }

  throw Error('Query not supported');
};
