import DynamoHelper from '../dynamoHelper';
import CognitoHelper, { CognitoGroup } from '../cognitoHelper';
import {
  Image,
  FederationRecord,
  Federation,
  FederationType,
  UserShort,
  FunctionEventBatch,
  UpdateFederationPrivateInput,
  UpdateFederationPrivatePayload,
  FederationConnection,
  FederationsPrivateFilterInput,
  FederationShortConnection,
  FederationShort,
} from '../types/federation';

class FederationModel {
  private readonly es: any;
  private readonly db: any;
  private readonly cognito: any;
  private readonly tableName: string;
  private readonly dynamoHelper: DynamoHelper;
  private readonly imagesDomain: string;
  private readonly userPoolId: string;
  private readonly uuidv4: () => string;

  constructor(
    db: any,
    tableName: string,
    imagesDomain: string,
    uuidv4: () => string,
    es: any,
    cognito: any,
    userPoolId: string,
  ) {
    this.es = es;
    this.db = db;
    this.cognito = cognito;
    this.tableName = tableName;
    this.imagesDomain = imagesDomain;
    this.userPoolId = userPoolId;
    this.dynamoHelper = new DynamoHelper(this.db, this.tableName);
    this.uuidv4 = uuidv4;
  }

  async create(
    userId: string,
    input: UpdateFederationPrivateInput,
  ): Promise<UpdateFederationPrivatePayload> {
    const federationPayload = await this.update(userId, input);

    const cognitoHelper = new CognitoHelper(this.cognito, this.userPoolId, userId);
    if (federationPayload && federationPayload.federation) {
      const federationId = federationPayload.federation.id;
      await cognitoHelper.addFederation(federationId);
      await cognitoHelper.addUserToGroup(CognitoGroup.FederationOwners);
    }

    return federationPayload;
  }

  async update(
    userId: string,
    input: UpdateFederationPrivateInput,
  ): Promise<UpdateFederationPrivatePayload> {
    const {
      id,
      name,
      description,
      cover,
      logo,
      email,
      phone,
      address,
      discipline = [],
      country,
      city,
      region,
      district,
      parentId,
      type,
    } = input;

    const isNew = !id;
    const pk = isNew ? `federation#${this.uuidv4()}` : `federation#${id}`;
    const sk = 'metadata';
    const defaultValues = isNew ? this.getDefaultValues(userId) : null;

    const metadata: FederationRecord = {
      ...defaultValues,
      name,
      description,
      cover,
      logo,
      email,
      phone,
      address,
      discipline,
      country,
      city,
      region,
      district,
      parentId,
      type,
    };

    if (!isNew) {
      metadata.modifiedAt = new Date().toISOString();
    }

    const { Attributes } = await this.dynamoHelper.updateItem(pk, sk, metadata);
    const federation = await this.getTypeFederation(Attributes);

    return {
      errors: [],
      federation,
    };
  }

  async getById(federationId: string): Promise<Federation | null> {
    const pk = `federation#${federationId}`;
    const sk = 'metadata';
    const { Item } = await this.dynamoHelper.getItem(pk, sk);
    return Item ? this.getTypeFederation(Item) : null;
  }

  async list(
    userId: string,
    filter: FederationsPrivateFilterInput = {},
    limit: number = 10,
    from: number = 0,
  ): Promise<FederationConnection> {
    const query = this.getEsQuery(userId, filter);
    const esResult = await this.esSearch({ query, limit, from });

    const totalCount = esResult.body?.hits.total.value || 0;
    const items = this.prepareEsItems(esResult.body?.hits.hits);

    const federations = [];
    for (const item of items) {
      const federation = await this.getTypeFederation(item);
      federations.push(federation);
    }

    return {
      items: federations,
      totalCount,
    };
  }

  async getChildrenFederationBatch(event: FunctionEventBatch[]) {
    const sub = event[0]?.identity.sub;

    /**
     * - get all team IDs
     * - search teams by parentTeamID
     */

    const limit = 100;
    const teamIds = event.map(({ source: { id } }) => id);

    const arrayOfPromises = teamIds.map((id) => {
      const filter = {
        parentId: id,
      };
      return this.list(sub, filter, limit);
    });

    const listResults = await Promise.all(arrayOfPromises);
    const result = listResults.map((listConnetion) => listConnetion.items);
    return result;
  }

  async getTeamFederationsBatch(event: FunctionEventBatch[]) {
    const sub = event[0]?.identity.sub;

    const limit = 100;
    const arrayOfIds: string[][] = event.map(({ source: { federations } }) => federations);

    const arrayOfPromises = arrayOfIds.map((ids) => {
      const filter = {
        ids,
      };
      return this.list(sub, filter, limit);
    });

    const listResults = await Promise.all(arrayOfPromises);
    const result = listResults.map((listConnetion) => listConnetion);
    return result;
  }

  async getTeams(federationId: string): Promise<{ id: string; clubId: string }[]> {
    try {
      const result = await this.es.search({
        index: 'teams',
        body: {
          size: 100,
          query: {
            match: {
              federations: federationId,
            },
          },
        },
      });

      return result.body?.hits.hits.map(({ _id, _source }: any) => ({
        id: _id,
        clubId: _source.clubId,
      }));
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      return [];
    }
  }

  async getMembers(teamIds: string[]): Promise<number> {
    const filterByTeams = this.getEsQueryTeams(null, teamIds, null);
    const must = [filterByTeams].filter((f) => !!f);

    const query = must.length
      ? {
          bool: {
            must,
          },
        }
      : null;

    const queryFilter = query ? { query } : null;

    try {
      const result = await this.es.count({
        index: 'users',
        body: {
          ...queryFilter,
        },
      });
      return result.body?.count;
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      return 0;
    }
  }

  async getTypeFederation({
    pk = '',
    name = '',
    description = '',
    cover,
    logo,
    email = '',
    phone = '',
    address = '',
    discipline = [],
    country = '',
    city = '',
    region = '',
    district = '',
    type = '',
    parentId,
  }: FederationRecord): Promise<Federation> {
    const federationId = pk.replace('federation#', '');
    const teams = await this.getTeams(federationId);
    const clubIds = teams.map(({ clubId }) => clubId);
    const teamIds = teams.map(({ id }) => id);
    const cloubsCount = new Set(clubIds).size;
    const membersCount = teamIds.length ? await this.getMembers(teamIds) : 0;

    return {
      id: federationId,
      name,
      description,
      cover: this.getTypeImage(cover),
      logo: this.getTypeImage(logo),
      email,
      phone,
      address,
      discipline,
      country,
      city,
      region,
      district,
      type,
      parentId,
      clubs: {
        items: [],
        totalCount: cloubsCount,
      },
      members: {
        items: [],
        totalCount: membersCount,
      },
      children: [],
    };
  }

  getTypeImage(image: string | null = ''): Image {
    return {
      url: image ? `https://${this.imagesDomain}/${image}` : '',
    };
  }

  getDefaultValues(userId: string) {
    return {
      ownerUserId: userId,
      createdAt: new Date().toISOString(),
    };
  }

  prepareEsItems(items: any[] = []) {
    return items.map(({ _id, _source }) => ({
      pk: `federation#${_id}`,
      ..._source,
    }));
  }

  getEsQueryBySearch(search: string) {
    return !search
      ? null
      : {
          bool: {
            should: [
              {
                wildcard: {
                  name: {
                    value: `*${search}*`,
                  },
                },
              },
              {
                match: {
                  description: search,
                },
              },
            ],
          },
        };
  }

  getEsQueryByArray(propertyName: string, values: string[]) {
    return values && values.length
      ? {
          bool: {
            should: values.map((value) => ({
              match: {
                [propertyName]: value,
              },
            })),
          },
        }
      : null;
  }

  getEsQueryByNotExists(field: string) {
    return {
      bool: {
        must_not: {
          exists: {
            field,
          },
        },
      },
    };
  }

  getEsQueryTeams(clubId: string | null, teamIds: string[], role: string | null) {
    const must: any = [
      {
        match: {
          'teams.status': 'Accepted',
        },
      },
    ];

    if (clubId) {
      must.push({
        match: {
          'teams.clubId': clubId,
        },
      });
    }

    must.push({
      bool: {
        should: teamIds.map((id) => ({
          match: {
            'teams.teamId': id,
          },
        })),
      },
    });

    if (role) {
      must.push({
        match: {
          'teams.role': role,
        },
      });
    }

    return {
      nested: {
        path: 'teams',
        query: {
          bool: {
            must,
          },
        },
      },
    };
  }

  getEsQueryByMatch(field: string, value?: string | null) {
    return !value
      ? null
      : {
          match: {
            [field]: value,
          },
        };
  }

  getEsQuery(userId: string, filter: FederationsPrivateFilterInput = {}) {
    const { search = '', discipline = [], parentId, isParent, ids = [] } = filter;
    const filterBySearch = this.getEsQueryBySearch(search);
    const filterByDiscipline = this.getEsQueryByArray('discipline', discipline);
    const filterByParentTeam = this.getEsQueryByMatch('parentId', parentId);
    const filterByIds = this.getEsQueryByArray('_id', ids);
    const filterByIsParent = isParent === true ? this.getEsQueryByNotExists('parentId') : null;

    const must = [
      filterBySearch,
      filterByDiscipline,
      filterByIsParent,
      filterByParentTeam,
      filterByIds,
    ].filter((f) => !!f);

    const query = must.length
      ? {
          bool: {
            must,
          },
        }
      : null;

    return query;
  }

  async esSearch({ query, limit, from }: { query: any; limit: number; from: number }) {
    try {
      const queryFilter = query ? { query } : null;

      const result = await this.es.search({
        index: 'federations',
        body: {
          from,
          size: limit,
          ...queryFilter,
          sort: [{ _id: 'asc' }],
        },
      });

      return result;
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      return { body: null };
    }
  }
}

export default FederationModel;
