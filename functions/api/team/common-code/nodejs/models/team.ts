import DynamoHelper from '../dynamoHelper';
import {
  UpdateTeamPrivateInput,
  UpdateTeamPrivatePayload,
  Image,
  Team,
  TeamRecord,
  TeamMemberType,
  TeamInvitationStatus,
  TeamsFilterInput,
  TeamsConnection,
  FunctionEventBatch,
} from '../types/team';

class TeamModel {
  private readonly es: any;
  private readonly db: any;
  private readonly tableName: string;
  private readonly dynamoHelper: DynamoHelper;
  private readonly imagesDomain: string;
  private readonly uuidv4: () => string;

  constructor(db: any, tableName: string, imagesDomain: string, uuidv4: () => string, es: any) {
    this.es = es;
    this.db = db;
    this.tableName = tableName;
    this.imagesDomain = imagesDomain;
    this.dynamoHelper = new DynamoHelper(this.db, this.tableName);
    this.uuidv4 = uuidv4;
  }

  async create(userId: string, input: UpdateTeamPrivateInput): Promise<UpdateTeamPrivatePayload> {
    return this.update(userId, input);
  }

  async update(userId: string, input: UpdateTeamPrivateInput): Promise<UpdateTeamPrivatePayload> {
    const {
      id,
      clubId,
      name,
      description,
      cover,
      logo,
      parentTeamId,
      address,
      email,
      phone,
      discipline,
      federations,
    } = input;

    const isNew = !id;
    const pk = `club#${clubId}`;
    const sk = isNew ? `team#${this.uuidv4()}` : `team#${id}`;
    const defaultValues = isNew ? this.getDefaultValues(userId) : null;

    const metadata: TeamRecord = {
      ...defaultValues,
      name,
      description,
      cover,
      logo,
      parentTeamId,
      address,
      email,
      phone,
      discipline,
      federations,
      modifiedAt: new Date().toISOString(),
    };

    const { Attributes } = await this.dynamoHelper.updateItem(pk, sk, metadata);

    return {
      errors: [],
      team: this.getTypeTeam(Attributes),
    };
  }

  async getById(clubId: string, teamId: string): Promise<Team | null> {
    const pk = `club#${clubId}`;
    const sk = `team#${teamId}`;
    const { Item } = await this.dynamoHelper.getItem(pk, sk);
    return this.getTypeTeam(Item);
  }

  async list(
    userId: string,
    filter: TeamsFilterInput = {},
    limit: number = 10,
    from: number = 0,
  ): Promise<TeamsConnection> {
    const query = this.getEsQuery(userId, filter);
    const esResult = await this.esSearch({ query, limit, from });

    const totalCount = esResult.body?.hits.total.value || 0;
    const items = this.prepareEsItems(esResult.body?.hits.hits);

    return {
      items: items.map((item) => this.getTypeTeam(item)),
      totalCount,
    };
  }

  async getClubTeamsBatch(event: FunctionEventBatch[]) {
    const sub = event[0]?.identity.sub;
    const clubIds = event.map(({ source: { id } }) => id);

    return await this.getTeamsByClubs(sub, clubIds);
  }

  async getParentTeamBatch(event: FunctionEventBatch[]) {
    const sub = event[0]?.identity.sub;

    const arrayOfKeys = event
      .filter((item) => item.source.parentTeam?.id)
      .map(({ source: { parentTeam, clubId } }) => ({
        pk: `club#${clubId}`,
        sk: `team#${parentTeam.id}`,
      }));
    const teams = await this.getTeamsByKeys(arrayOfKeys);

    const result = event.map(({ source: { parentTeam } }) =>
      parentTeam?.id
        ? {
            ...teams.get(`team#${parentTeam?.id}`),
          }
        : null,
    );

    return result;
  }

  async getChildrenTeamsBatch(event: FunctionEventBatch[]) {
    const sub = event[0]?.identity.sub;

    /**
     * - get all team IDs
     * - search teams by parentTeamID
     */

    const limit = 10;
    const teamIds = event.map(({ source: { id } }) => id);

    const arrayOfPromises = teamIds.map((id) => {
      const filter = {
        parentTeamId: id,
      };
      return this.list(sub, filter, limit);
    });

    const listResults = await Promise.all(arrayOfPromises);
    const result = listResults.map((teamConnetion) => teamConnetion.items);
    return result;
  }

  async getTeamsByClubs(userId: string, clubIds: string[]): Promise<TeamsConnection[]> {
    const limit = 10;

    const arrayOfPromises = clubIds.map((id) => {
      const filter = {
        clubIds: [id],
      };
      return this.list(userId, filter, limit);
    });

    const listResults = await Promise.all(arrayOfPromises);
    return listResults;
  }

  async getTeamsByKeys(arrayOfKeys: { pk: string; sk: string }[]): Promise<Map<string, Team>> {
    const result = await this.dynamoHelper.batchGet(arrayOfKeys, 'sk', (item) =>
      this.getTypeTeam(item),
    );
    return result;
  }

  getTypeTeam({
    pk = '',
    sk = '',
    name = '',
    description = '',
    cover,
    logo,
    parentTeamId,
    address = '',
    email = '',
    phone = '',
    discipline = null,
    federations,
    ciCount = 0,
    miCount = 0,
  }: TeamRecord): Team {
    return {
      id: sk.replace('team#', ''),
      clubId: pk.replace('club#', ''),
      name,
      description,
      cover: this.getTypeImage(cover),
      logo: this.getTypeImage(logo),
      parentTeam: {
        // @ts-ignore
        id: parentTeamId,
      },
      address,
      email,
      phone,
      discipline,
      coaches: null,
      members: null,
      friends: null,
      federations: {
        items: [
          {
            id: '111',
            name: 'Federation Name',
            logo: this.getTypeImage('club/i/logo2.jpg'),
          },
        ],
        totalCount: 1,
      },
      upcomingEventsCount: 0,
      coacheInvitationsCount: ciCount || 0,
      memberInvitationsCount: miCount || 0,
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
      ciCount: 0,
      miCount: 0,
    };
  }

  prepareEsItems(items: any[] = []) {
    return items.map(({ _id, _source }) => ({
      pk: `club#${_source.clubId}`,
      sk: `team#${_id}`,
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

  getEsQuery(userId: string, filter: TeamsFilterInput = {}) {
    const { search = '', discipline = [], clubIds = [], parentTeamId, isParent } = filter;

    const filterBySearch = this.getEsQueryBySearch(search);
    const filterByDiscipline = this.getEsQueryByArray('discipline', discipline);
    const filterByClubIds = this.getEsQueryByArray('clubId', clubIds);
    const filterByParentTeam = this.getEsQueryByMatch('parentTeamId', parentTeamId);
    const filterByIsParent = isParent === true ? this.getEsQueryByNotExists('parentTeamId') : null;

    const must = [
      filterBySearch,
      filterByClubIds,
      filterByDiscipline,
      filterByParentTeam,
      filterByIsParent,
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
        index: 'teams',
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

export default TeamModel;
