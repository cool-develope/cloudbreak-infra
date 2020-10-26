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

    return {
      errors: [],
      federation: this.getTypeFederation(Attributes),
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

    return {
      items: items.map((item) => this.getTypeFederation(item)),
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
    console.debug(result);
    return result;
  }

  // async getClubTeamsBatch(event: FunctionEventBatch[]) {
  //   const sub = event[0]?.identity.sub;
  //   const clubIds = event.map(({ source: { id } }) => id);

  //   return await this.getTeamsByClubs(sub, clubIds);
  // }

  // async getParentTeamBatch(event: FunctionEventBatch[]) {
  //   const sub = event[0]?.identity.sub;

  //   const arrayOfKeys = event
  //     .filter((item) => item.source.parentTeam?.id)
  //     .map(({ source: { parentTeam, clubId } }) => ({
  //       pk: `club#${clubId}`,
  //       sk: `team#${parentTeam.id}`,
  //     }));
  //   const teams = await this.getTeamsByKeys(arrayOfKeys);

  //   const result = event.map(({ source: { parentTeam } }) =>
  //     parentTeam?.id
  //       ? {
  //           ...teams.get(`team#${parentTeam?.id}`),
  //         }
  //       : null,
  //   );

  //   return result;
  // }

  // async getTeamsByClubs(userId: string, clubIds: string[]): Promise<TeamsConnection[]> {
  //   const limit = 10;

  //   const arrayOfPromises = clubIds.map((id) => {
  //     const filter = {
  //       clubIds: [id],
  //     };
  //     return this.list(userId, filter, limit);
  //   });

  //   const listResults = await Promise.all(arrayOfPromises);
  //   return listResults;
  // }

  // async getTeamsByKeys(arrayOfKeys: { pk: string; sk: string }[]): Promise<Map<string, Team>> {
  //   const result = await this.dynamoHelper.batchGet(arrayOfKeys, 'sk', (item) =>
  //     this.getTypeTeam(item),
  //   );
  //   return result;
  // }

  getTypeFederation({
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
  }: FederationRecord): Federation {
    return {
      id: pk.replace('federation#', ''),
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
        totalCount: 0,
      },
      members: {
        items: [],
        totalCount: 0,
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
    const { search = '', discipline = [], parentId, isParent } = filter;
    const filterBySearch = this.getEsQueryBySearch(search);
    const filterByDiscipline = this.getEsQueryByArray('discipline', discipline);
    const filterByParentTeam = this.getEsQueryByMatch('parentId', parentId);
    const filterByIsParent = isParent === true ? this.getEsQueryByNotExists('parentId') : null;

    const must = [filterBySearch, filterByDiscipline, filterByIsParent, filterByParentTeam].filter(
      (f) => !!f,
    );

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
