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

interface EventOrganizationFromSource {
  id: string;
  type: OrganizationType;
}

interface ClubRecord {
  name: string;
  treezorWalletId?: number;
}

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN, ES_DOMAIN } = process.env;

const db = new AWS.DynamoDB.DocumentClient();
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);

const getTypeEventOrganization = ({
  name,
  treezorWalletId: walletId = 0,
}: ClubRecord): EventOrganizationFromBatch => ({
  name,
  walletId,
});

const getOrganization = (
  organization: EventOrganizationFromSource,
  batchMap: Map<string, any>,
): EventOrganization => {
  const pkPreffix = organization.type === OrganizationType.Federation ? 'federation' : 'club';
  const pk = `${pkPreffix}#${organization.id}`;
  const orgFromBatch = batchMap.get(pk);

  return {
    ...organization,
    ...orgFromBatch,
  };
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

  const ids = event.map(
    ({
      source: {
        organization: { id, type },
      },
    }) => `${type === OrganizationType.Federation ? 'federation' : 'club'}#${id}`,
  );
  const uniqIds = new Set(ids);
  const arrayOfKeys = [...uniqIds].map((pk) => ({
    pk,
    sk: 'metadata',
  }));

  console.log(arrayOfKeys);

  const batchMap = await dynamoHelper.batchGet(arrayOfKeys, 'pk', (item) =>
    getTypeEventOrganization(item),
  );

  console.log(batchMap);

  const result = event.map(({ source: { __typename, organization } }) => ({
    __typename,
    ...getOrganization(organization, batchMap),
  }));

  return result;
};
