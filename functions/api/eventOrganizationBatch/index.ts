// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import DynamoHelper from './dynamoHelper';

enum OrganizationType {
  Federation = 'Federation',
  Club = 'Club',
}

interface EventOrganization {
  id: string;
  name: string;
  type: OrganizationType;
  walletId: number;
}

interface EventOrganizationFromBatch {
  name: string;
  walletId: number;
}

interface NameAndOwner {
  name: string;
  ownerUserId: string;
}

interface EventOrganizationFromSource {
  id: string;
  type: OrganizationType;
}

interface ClubRecord {
  name: string;
  ownerUserId: string;
}

interface UserRecord {
  treezorWalletId?: null;
}

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN, ES_DOMAIN } = process.env;

const db = new AWS.DynamoDB.DocumentClient();
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);

const getOrganization = (
  organization: EventOrganizationFromSource,
  orgOwners: Map<string, NameAndOwner>,
  userWallets: Map<string, number>,
): EventOrganization => {
  const pkPreffix = organization.type === OrganizationType.Federation ? 'federation' : 'club';
  const pk = `${pkPreffix}#${organization.id}`;
  const ownerUser = orgOwners.get(pk);

  let name = '';
  let walletId = 0;

  if (ownerUser) {
    name = ownerUser.name;
    walletId = userWallets.get(`user#${ownerUser.ownerUserId}`) || 0;
  }

  return {
    ...organization,
    name,
    walletId,
  };
};

/**
 * Set.Key and Map.Key - organization PK, club#111
 * @param ids
 */
const getOrganizationOwner = async (pks: string[]): Promise<Map<string, NameAndOwner>> => {
  const keys = [...new Set(pks)].map((pk) => ({
    pk,
    sk: 'metadata',
  }));

  return await dynamoHelper.batchGet(keys, 'pk', ({ name, ownerUserId }) => ({
    name,
    ownerUserId,
  }));
};

/**
 * Set.Key and Map.Key - user PK, user#111
 * @param ids
 */
const getUserWallet = async (userIds: string[]): Promise<Map<string, number>> => {
  const keys = [...new Set(userIds)].map((id) => ({
    pk: `user#${id}`,
    sk: 'metadata',
  }));

  return await dynamoHelper.batchGet(keys, 'pk', (item) => item?.treezorWalletId || 0);
};

export const handler: Handler = async (
  event: {
    fieldName: string;
    source: {
      __typename: string;
      id: string;
      organization: EventOrganizationFromSource;
    };
    identity: any;
  }[],
) => {
  console.log(JSON.stringify(event, null, 4));

  /**
   * Receive id from event (clubId, federationId)
   * 1. get ownerUserId from club/federation metadata
   * 2. get treezorWalletId from user metadata
   */

  const pks = event.map(
    ({
      source: {
        organization: { id, type },
      },
    }) => `${type === OrganizationType.Federation ? 'federation' : 'club'}#${id}`,
  );

  const orgOwners = await getOrganizationOwner(pks);
  const userIds = [...orgOwners.values()].map((item) => item.ownerUserId);
  const userWallets = await getUserWallet(userIds);

  console.log({ orgOwners, userWallets });

  const result = event.map(({ source: { __typename, organization } }) => ({
    __typename,
    ...getOrganization(organization, orgOwners, userWallets),
  }));

  return result;
};
