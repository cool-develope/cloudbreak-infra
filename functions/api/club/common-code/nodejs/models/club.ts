import DynamoHelper from '../dynamoHelper';
import CognitoHelper, { CognitoGroup } from '../cognitoHelper';
import {
  UpdateClubPrivateInput,
  UpdateClubPrivatePayload,
  Image,
  Club,
  ClubsConnection,
  ClubsFilterInput,
  ClubRecord,
  TeamMemberType,
  TeamInvitationStatus,
  CognitoClaims,
} from '../types/club';

interface TeamStats {
  clubId: string;
  teamId: string;
  status: string;
  role: string;
  count: number;
}

class ClubModel {
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
    claims: CognitoClaims,
    input: UpdateClubPrivateInput,
  ): Promise<UpdateClubPrivatePayload> {
    /**
     * ! SECURITY
     * - have only one club - check in token and DynamoDB
     * - have 'club-owners' in 'cognito:groups'
     */

    const { sub, ['cognito:groups']: groups = [], ['custom:clubs']: clubs = '' } = claims;
    const haveClubOwnersGroup = (groups || []).includes('club-owners');
    if (!haveClubOwnersGroup) {
      return {
        errors: ['You are not allowed to create a club.', 'Access Denied'],
        club: null,
      };
    }

    const haveClubInToken = clubs && clubs.length;
    const clubIds = await this.getClubsByOwnerUserId(sub);
    const haveClubInDB = clubIds && clubIds.length;
    if (haveClubInToken || haveClubInDB) {
      return {
        errors: ['You can have only one club'],
        club: null,
      };
    }

    const clubPayload = await this.update(claims, input);

    const cognitoHelper = new CognitoHelper(this.cognito, this.userPoolId, sub);
    if (clubPayload && clubPayload.club) {
      const clubId = clubPayload.club.id;
      await cognitoHelper.addClub(clubId);
      await cognitoHelper.addUserToGroup(CognitoGroup.ClubOwners);
    }

    return clubPayload;
  }

  async update(
    claims: CognitoClaims,
    input: UpdateClubPrivateInput,
  ): Promise<UpdateClubPrivatePayload> {
    /**
     * ! SECURITY
     * - have id in 'custom:clubs'
     * - have 'club-owners' in 'cognito:groups'
     */

    const { sub, ['cognito:groups']: groups = [], ['custom:clubs']: clubs = '' } = claims;
    const haveClubOwnersGroup = (groups || []).includes('club-owners');
    if (!haveClubOwnersGroup) {
      return {
        errors: ['You are not allowed to update a club.', 'Access Denied'],
        club: null,
      };
    }

    const {
      id,
      name,
      description,
      cover,
      logo,
      code,
      email,
      phone,
      country,
      city,
      address,
      discipline,
    } = input;

    const isNew = !id;
    const pk = isNew ? `club#${this.uuidv4()}` : `club#${id}`;
    const defaultValues = isNew ? this.getDefaultValues(sub) : null;

    if (id) {
      const clubIds = await this.getClubsByOwnerUserId(sub);
      const haveClubInDB = clubIds && clubIds.length && clubIds.includes(id);
      if (!haveClubInDB) {
        return {
          errors: ['You are not allowed to update this club.', 'Access Denied'],
          club: null,
        };
      }
    }

    const metadata: ClubRecord = {
      ...defaultValues,
      name,
      description,
      cover,
      logo,
      code,
      email,
      phone,
      country,
      city,
      address,
      discipline,
      modifiedAt: new Date().toISOString(),
    };

    const { Attributes } = await this.dynamoHelper.updateItem(pk, 'metadata', metadata);
    const teamStats = await this.getTeamStats();

    return {
      errors: [],
      club: this.getTypeClub(Attributes, teamStats),
    };
  }

  async getById(clubId: string): Promise<Club | null> {
    const pk = `club#${clubId}`;
    const { Item } = await this.dynamoHelper.getItem(pk, 'metadata');
    const teamStats = await this.getTeamStats();
    return this.getTypeClub(Item, teamStats);
  }

  async list(
    userId: string,
    filter: ClubsFilterInput = {},
    limit: number = 10,
    from: number = 0,
  ): Promise<ClubsConnection> {
    const query = await this.getEsQuery(userId, filter);
    let sort = [{ 'country.keyword': 'asc', 'city.keyword': 'asc', 'name.keyword': 'asc' }];
    if (filter.nearMe === true) {
      sort = [];
    }

    const esResult = await this.esSearch({ query, limit, from, sort });
    const teamStats = await this.getTeamStats();

    const totalCount = esResult.body?.hits.total.value || 0;
    const items = this.prepareEsItems(esResult.body?.hits.hits);

    return {
      items: items.map((item) => this.getTypeClub(item, teamStats)),
      totalCount,
    };
  }

  getTypeClub(data: ClubRecord, teamStats: TeamStats[]): Club {
    const {
      pk = '',
      name = ' ',
      description = '',
      cover,
      logo,
      code = '',
      email = '',
      phone = '',
      country = '',
      city = '',
      address = '',
      discipline = [],
    } = data;

    const id = pk.replace('club#', '');

    return {
      id,
      name,
      description,
      cover: this.getTypeImage(cover),
      logo: this.getTypeImage(logo),
      code,
      email,
      phone,
      country,
      city,
      address,
      discipline,
      teams: null,
      coaches: null,
      members: null,
      friends: null,
      upcomingEventsCount: 0,
      coacheInvitationsCount: this.getClubStats(
        teamStats,
        id,
        null,
        TeamMemberType.Coach,
        TeamInvitationStatus.Pending,
      ),
      memberInvitationsCount: this.getClubStats(
        teamStats,
        id,
        null,
        TeamMemberType.Member,
        TeamInvitationStatus.Pending,
      ),
    };
  }

  getTypeImage(image: string = ''): Image {
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

  async getClubsByOwnerUserId(ownerUserId: string): Promise<string[]> {
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'sk = :sk and begins_with(pk, :pk)',
      FilterExpression: 'ownerUserId = :ownerUserId',
      ExpressionAttributeValues: {
        ':sk': 'metadata',
        ':pk': 'club#',
        ':ownerUserId': ownerUserId,
      },
    };

    const { Items } = await this.db.query(params).promise();
    return Items.map(({ pk }: ClubRecord) => pk?.replace('club#', ''));
  }

  prepareEsItems(items: any[] = []) {
    return items.map(({ _id, _source }) => ({
      pk: `club#${_id}`,
      ..._source,
    }));
  }

  getEsQueryByMatch(field: string, value: string) {
    return !value
      ? null
      : {
          match: {
            [field]: value,
          },
        };
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
              {
                match: {
                  code: search,
                },
              },
            ],
          },
        };
  }

  getEsQueryByDiscipline(discipline: string[]) {
    return discipline && discipline.length
      ? {
          bool: {
            should: discipline.map((value) => ({
              match: {
                discipline: value,
              },
            })),
          },
        }
      : null;
  }

  getEsQueryByArray(propertyName: string, values?: string[]) {
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

  getEsQueryByNearMe(country: string, city: string) {
    return {
      function_score: {
        query: { match_all: {} },
        boost: 1,
        functions: [
          {
            filter: { match: { country } },
            weight: 10,
          },
          {
            filter: { match: { city } },
            weight: 100,
          },
        ],
        max_boost: 100,
        score_mode: 'max',
        boost_mode: 'multiply',
        min_score: 10,
      },
    };
  }

  async getMyClubs(userId: string): Promise<string[]> {
    const { Items }: { Items: any[] | null } = await this.dynamoHelper.queryItemsByIndex(
      `user#${userId}`,
      'team#',
      'GSI1',
    );
    let ids =
      Items?.filter(({ status }) => status === 'Accepted').map(({ clubId }) => clubId) ?? [];

    return ids;
  }

  async getEsQuery(userId: string, filter: ClubsFilterInput = {}) {
    let { search = '', city = '', discipline = [], clubIds, nearMe, myClubs } = filter;

    let filterByNearMe = null;
    if (userId && nearMe === true) {
      const { Item: userData } = await this.dynamoHelper.getItem(`user#${userId}`, 'metadata');
      filterByNearMe = this.getEsQueryByNearMe(userData.country, userData.city);
    }

    let filterByMyClubs = null;
    if (userId && myClubs === true) {
      clubIds = await this.getMyClubs(userId);
    }

    const filterBySearch = this.getEsQueryBySearch(search);
    const filterByCity = this.getEsQueryByMatch('city', city);
    const filterById = this.getEsQueryByArray('_id', clubIds);
    const filterByDiscipline = this.getEsQueryByDiscipline(discipline);

    const must = [
      filterBySearch,
      filterByCity,
      filterByDiscipline,
      filterById,
      filterByNearMe,
      filterByMyClubs,
    ].filter((f) => !!f);

    const query = must.length
      ? {
          bool: {
            must,
          },
        }
      : null;

    console.log(JSON.stringify(query, null, 2));

    return query;
  }

  async esSearch({
    query,
    limit,
    from,
    sort,
  }: {
    query: any;
    limit: number;
    from: number;
    sort: Object[];
  }) {
    try {
      const queryFilter = query ? { query } : null;

      const result = await this.es.search({
        index: 'clubs',
        body: {
          from,
          size: limit,
          ...queryFilter,
          sort,
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

export default ClubModel;
