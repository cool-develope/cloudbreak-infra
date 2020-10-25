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

interface TeamStats {
  clubId: string;
  teamId: string;
  status: string;
  role: string;
  count: number;
}

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
    const teamStats = await this.getTeamStats();

    return {
      errors: [],
      team: this.getTypeTeam(Attributes, teamStats),
    };
  }

  async getById(clubId: string, teamId: string): Promise<Team | null> {
    const pk = `club#${clubId}`;
    const sk = `team#${teamId}`;
    const { Item } = await this.dynamoHelper.getItem(pk, sk);
    const teamStats = await this.getTeamStats();

    return this.getTypeTeam(Item, teamStats);
  }

  async list(
    userId: string,
    filter: TeamsFilterInput = {},
    limit: number = 10,
    from: number = 0,
  ): Promise<TeamsConnection> {
    const query = this.getEsQuery(userId, filter);
    const esResult = await this.esSearch({ query, limit, from });
    const teamStats = await this.getTeamStats();

    const totalCount = esResult.body?.hits.total.value || 0;
    const items = this.prepareEsItems(esResult.body?.hits.hits);

    return {
      items: items.map((item) => this.getTypeTeam(item, teamStats)),
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

    const teamStats = await this.getTeamStats();
    const teams = await this.getTeamsByKeys(arrayOfKeys, teamStats);

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

    const limit = 100;
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
    const limit = 100;

    const arrayOfPromises = clubIds.map((id) => {
      const filter = {
        clubIds: [id],
      };
      return this.list(userId, filter, limit);
    });

    const listResults = await Promise.all(arrayOfPromises);
    return listResults;
  }

  async getTeamsByKeys(
    arrayOfKeys: { pk: string; sk: string }[],
    teamStats: TeamStats[],
  ): Promise<Map<string, Team>> {
    const result = await this.dynamoHelper.batchGet(arrayOfKeys, 'sk', (item) =>
      this.getTypeTeam(item, teamStats),
    );
    return result;
  }

  getTypeTeam(data: TeamRecord, teamStats: TeamStats[]): Team {
    const {
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
    } = data;

    const id = sk.replace('team#', '');
    const clubId = pk.replace('club#', '');

    // TODO: federations
    // TODO: upcomingEventsCount

    return {
      id,
      clubId,
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
      coacheInvitationsCount: this.getClubStats(
        teamStats,
        clubId,
        id,
        TeamMemberType.Coach,
        TeamInvitationStatus.Pending,
      ),
      memberInvitationsCount: this.getClubStats(
        teamStats,
        clubId,
        id,
        TeamMemberType.Member,
        TeamInvitationStatus.Pending,
      ),
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

  getClubStats(
    teams: TeamStats[],
    clubId: string | null,
    teamId: string | null,
    role: string,
    status: string,
  ): number {
    const itemsByClub = clubId ? teams.filter((item) => item.clubId === clubId) : teams;
    const itemsByTeam = teamId ? itemsByClub.filter((item) => item.teamId === teamId) : itemsByClub;
    const items = itemsByTeam.filter((item) => item.role === role && item.status === status);
    const count = items.reduce((prev, { count = 0 }) => prev + count, 0);
    return count;
  }

  async getTeamStats(): Promise<TeamStats[]> {
    const teams = [];

    try {
      const response = await this.es.search({
        index: 'users',
        body: {
          size: 0,
          aggs: {
            teams: {
              nested: {
                path: 'teams',
              },
              aggs: {
                club: {
                  terms: {
                    field: 'teams.clubId.keyword',
                    size: 1000,
                  },
                  aggs: {
                    team: {
                      terms: {
                        field: 'teams.teamId.keyword',
                      },
                      aggs: {
                        role: {
                          terms: {
                            field: 'teams.role.keyword',
                            size: 1000,
                          },
                          aggs: {
                            status: {
                              terms: {
                                field: 'teams.status.keyword',
                                size: 1000,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      for (const club of response.body.aggregations.teams.club.buckets) {
        const clubId = club.key;
        for (const team of club.team.buckets) {
          const teamId = team.key;
          for (const role of team.role.buckets) {
            const roleName = role.key;
            for (const status of role.status.buckets) {
              const statusName = status.key;
              const statusCount = status.doc_count;

              teams.push({
                clubId,
                teamId,
                role: roleName,
                status: statusName,
                count: statusCount,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    }

    return teams;
  }
}

export default TeamModel;
