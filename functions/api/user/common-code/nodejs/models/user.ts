import DynamoHelper from '../dynamoHelper';
import {
  Image,
  EsUserRecord,
  TeamMemberType,
  TeamInvitationStatus,
  FunctionEventBatch,
  UsersFilter,
  FieldName,
  UserShort,
  UserShortConnection,
  UsersPrivateConnection,
  UserPrivate,
  TeamMemberDetails,
  TeamShort,
  Organization,
  OrganizationType,
  OrganizationRole,
  UpdateUserPrivateInput,
  UserChild,
  TreezorUser,
  SortOrderEnum,
} from '../types/user';

class UserModel {
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

  async listBatch(event: FunctionEventBatch[]): Promise<any> {
    const field = event[0]?.fieldName;
    const sub = event[0]?.identity?.sub;

    if (
      field === FieldName.clubCoaches ||
      field === FieldName.clubMembers ||
      field === FieldName.clubFriends
    ) {
      const role = field === FieldName.clubCoaches ? TeamMemberType.Coach : TeamMemberType.Member;
      const arrayOfPromises = event.map(({ source: { id: clubId } }) =>
        this.listShort(sub, { clubId, role }),
      );

      return await Promise.all(arrayOfPromises);
    } else if (
      field === FieldName.teamCoaches ||
      field === FieldName.teamMembers ||
      field === FieldName.teamFriends
    ) {
      const role = field === FieldName.teamCoaches ? TeamMemberType.Coach : TeamMemberType.Member;
      const arrayOfPromises = event.map(({ source: { id: teamId } }) =>
        this.listShort(sub, { teamId, role }),
      );

      return await Promise.all(arrayOfPromises);
    }

    throw Error('Not supported query');
  }

  async listShort(
    userId: string,
    filter: any = {},
    limit: number = 10,
    from: number = 0,
  ): Promise<UserShortConnection> {
    const query = this.getEsQueryListShort(userId, filter);
    const esResult = await this.esSearch({ query, limit, from });

    const totalCount = esResult.body?.hits.total.value || 0;
    const items = this.prepareEsItems(esResult.body?.hits.hits);

    return {
      items: items.map((item) => this.getTypeUserShort(item)),
      totalCount,
    };
  }

  async list(
    userId: string,
    filter: UsersFilter = {},
    limit: number = 10,
    from: number = 0,
  ): Promise<UsersPrivateConnection> {
    const query = this.getEsQueryList(userId, filter);
    const esResult = await this.esSearch({
      query,
      limit,
      from,
      sort: { 'firstName.keyword': SortOrderEnum.ASC },
    });

    const totalCount = esResult.body?.hits.total.value || 0;
    const esItems = this.prepareEsItems(esResult.body?.hits.hits);

    const arrayOfPromises = esItems.map((item) => this.getTypeUserPrivate(item));
    const items = await Promise.all(arrayOfPromises);

    return {
      items,
      totalCount,
    };
  }

  async getById(userId: string): Promise<UserPrivate> {
    const esUser = await this.esGet(userId);
    return await this.getTypeUserPrivate(esUser);
  }

  delay(ms: number) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, ms);
    });
  }

  async updateUserPrivate(sub: string, input: UpdateUserPrivateInput): Promise<UserPrivate> {
    const { userId, firstName, lastName, photo, birthDate, gender } = input;
    const pk = `user#${userId}`;
    const sk = 'metadata';

    await this.dynamoHelper.updateItem(pk, sk, {
      firstName,
      lastName,
      photo,
      birthDate,
      gender,
    });

    await this.delay(4000);
    return this.getById(userId);
  }

  async getTeamMemberDetails(
    userId: string,
    teams: { clubId: string; teamId: string; role: TeamMemberType; status: TeamInvitationStatus }[],
  ): Promise<TeamMemberDetails[]> {
    const result: TeamMemberDetails[] = [];

    if (teams && teams.length) {
      for await (const { clubId, teamId, role, status } of teams) {
        const [teamShort, clubShort] = await Promise.all([
          this.getTeamShort(clubId, teamId),
          this.getClubShort(clubId),
        ]);

        // TODO: Mock data
        const federationList: TeamShort[] = [
          {
            id: '111',
            name: 'Federation Name',
            logo: this.getTypeImage('club/i/logo2.jpg'),
          },
        ];

        result.push({
          club: clubShort,
          team: teamShort,
          federation: federationList,
          role,
          status,
        });
      }
    }

    return result;
  }

  async getTeamShort(clubId: string, teamId: string): Promise<TeamShort> {
    const {
      Item: { name, logo },
    } = await this.dynamoHelper.getItem(`club#${clubId}`, `team#${teamId}`);
    return {
      id: teamId,
      name,
      logo: this.getTypeImage(logo),
    };
  }

  async getClubShort(clubId: string): Promise<TeamShort> {
    const {
      Item: { name, logo },
    } = await this.dynamoHelper.getItem(`club#${clubId}`, 'metadata');
    return {
      id: clubId,
      name,
      logo: this.getTypeImage(logo),
    };
  }

  getTypeUserShort({ id, firstName, lastName, photo }: EsUserRecord): UserShort {
    return {
      id,
      name: `${firstName} ${lastName}`,
      logo: this.getTypeImage(photo),
    };
  }

  getTypeUserChild({
    firstName = '',
    lastName = '',
    photo = '',
    email = '',
    birthDate = '',
    gender = '',
    phone = '',
    treezorUserId = '',
    treezorWalletId = '',
  }: any): UserChild {
    return {
      firstName,
      lastName,
      photo: this.getTypeImage(photo),
      email,
      birthDate,
      gender,
      phone,
      treezor: {
        userId: treezorUserId,
        walletId: treezorWalletId,
      },
    };
  }

  async getTypeUserPrivate({
    id,
    email,
    firstName,
    lastName,
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
    createdAt,
    teams,
    children: esChildren,
    companyId,
    parentUserId,
    treezorUserId = null,
    treezorWalletId = null,
  }: any = {}): Promise<UserPrivate> {
    const teamsDetails = await this.getTeamMemberDetails(id, teams);
    const organization = await this.getOrganization(id, companyId, teamsDetails);
    const children = await this.getChildren(esChildren);
    const parent = await this.getUserChild(parentUserId);
    const treezor: TreezorUser = {
      userId: treezorUserId,
      walletId: treezorWalletId,
    };

    const user = {
      id,
      email,
      firstName,
      lastName,
      country,
      photo: this.getTypeImage(photo),
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
      createDate: createdAt,
      parent,
      children,
      organization,
      treezor,
      teams: teamsDetails,
    };

    return user;
  }

  getTypeImage(image: string | null = ''): Image {
    return {
      url: image ? `https://${this.imagesDomain}/${image}` : '',
    };
  }

  prepareEsItems(items: any[] = []): any[] {
    return items.map(({ _id, _source }) => ({ id: _id, ..._source }));
  }

  getEsQueryBySearch(search?: string) {
    return !search
      ? null
      : {
          bool: {
            should: [
              {
                wildcard: {
                  firstName: {
                    value: `*${search}*`,
                  },
                },
              },
              {
                wildcard: {
                  lastName: {
                    value: `*${search}*`,
                  },
                },
              },
              {
                wildcard: {
                  email: {
                    value: `*${search}*`,
                  },
                },
              },
            ],
          },
        };
  }

  getEsQueryTeams(clubId: string, teamId: string, role: string) {
    const must: any = [
      {
        match: {
          'teams.status': TeamInvitationStatus.Accepted,
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

    if (teamId) {
      must.push({
        match: {
          'teams.teamId': teamId,
        },
      });
    }

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

  getEsQueryTeamsArray(boolCondition: string, propertyName: string, values?: string[]) {
    if (values && values.length) {
      const result = {
        nested: {
          path: 'teams',
          query: {
            bool: {
              [boolCondition]: values.map((value) => ({
                term: { [`teams.${propertyName}.keyword`]: value },
              })),
            },
          },
        },
      };

      return result;
    }

    return null;
  }

  getEsQueryTeamsMultiParams(boolCondition: string, filter: Object) {
    const entries = Object.entries(filter || {}).filter(([k, v]) => v !== null && v !== undefined);

    if (entries.length) {
      return {
        nested: {
          path: 'teams',
          query: {
            bool: {
              [boolCondition]: entries.map(([key, value]) => ({
                term: { [`teams.${key}.keyword`]: value },
              })),
            },
          },
        },
      };
    }

    return null;
  }

  getEsQueryListShort(userId: string, filter: any = {}) {
    const {
      search,
      clubId,
      teamId,
      role,
    }: {
      search: string;
      clubId: string;
      teamId: string;
      role: string;
    } = filter;

    const filterBySearch = this.getEsQueryBySearch(search);
    const filterByTeams = this.getEsQueryTeams(clubId, teamId, role);
    const must = [filterBySearch, filterByTeams].filter((f) => !!f);

    const query = must.length
      ? {
          bool: {
            must,
          },
        }
      : null;

    return query;
  }

  getEsQueryByDate(field: string, gte?: string, lte?: string) {
    return !gte && !lte
      ? null
      : {
          range: {
            [field]: {
              gte,
              lte,
            },
          },
        };
  }

  getEsQueryExists(field: string) {
    return {
      exists: {
        field,
      },
    };
  }

  getEsQueryList(userId: string, filter: UsersFilter = {}) {
    const {
      search,
      clubIds,
      teamIds,
      userIds,
      hasWallet,
      role,
      status,
      createDateAfter,
      createDateBefore,
      birthDateAfter,
      birthDateBefore,
    } = filter;
    const roles = role ? [role] : [];
    const statuses = status
      ? [status]
      : [
          TeamInvitationStatus.Pending,
          TeamInvitationStatus.Accepted,
          TeamInvitationStatus.Declined,
        ];

    let filterByTeamsArray: any[] = [];
    const teamsCount = teamIds?.length ?? 0;
    const clubsCount = clubIds?.length ?? 0;
    const rolesCount = roles?.length ?? 0;

    // TODO: improve it in future
    if (statuses.length === 1 && teamsCount <= 1 && clubsCount <= 1 && rolesCount <= 1) {
      /**
       * Search with all of params
       */
      filterByTeamsArray = [
        this.getEsQueryTeamsMultiParams('must', {
          clubId: clubIds?.[0],
          teamId: teamIds?.[0],
          role: roles?.[0],
          status: statuses?.[0],
        }),
      ];
    } else {
      /**
       * Search with any of this params
       */
      filterByTeamsArray = [
        this.getEsQueryTeamsArray('should', 'teamId', teamIds),
        this.getEsQueryTeamsArray('should', 'clubId', clubIds),
        this.getEsQueryTeamsArray('must', 'role', roles),
        this.getEsQueryTeamsArray('should', 'status', statuses),
      ];
    }

    const filterBySearch = this.getEsQueryBySearch(search);
    const filterByUsers = this.getEsQueryTeamsArray('should', '_id', userIds);
    const filterByHasWallet = hasWallet === true ? this.getEsQueryExists('treezorWalletId') : null;
    const filterByCreateDate = this.getEsQueryByDate(
      'createdAt',
      createDateAfter,
      createDateBefore,
    );
    const filterByBirthDate = this.getEsQueryByDate('birthDate', birthDateAfter, birthDateBefore);

    const must = [
      filterBySearch,
      filterByUsers,
      filterByCreateDate,
      filterByBirthDate,
      filterByHasWallet,
      ...filterByTeamsArray,
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

  async esSearch({
    query,
    limit,
    from,
    sort = { _id: SortOrderEnum.ASC },
  }: {
    query: any;
    limit: number;
    from: number;
    sort?: any;
  }) {
    try {
      const queryFilter = query ? { query } : null;

      const result = await this.es.search({
        index: 'users',
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

  async esGet(id: string) {
    try {
      const {
        body: { _id, _source },
      } = await this.es.get({
        index: 'users',
        id,
      });

      if (_source) {
        return { id: _id, ..._source };
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }

    return null;
  }

  async getOrganization(
    userId: string,
    companyId: string,
    teamsDetails: TeamMemberDetails[],
  ): Promise<Organization | null> {
    const { Items } = await this.queryItemsByIndexAndFilter('metadata', 'club#', 'GSI1', userId);

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
        logo: this.getTypeImage(club.logo),
      };
    } else {
      /**
       * CLUB COACH
       */
      const coachInTeam = teamsDetails.find((team) => team.role === TeamMemberType.Coach);
      if (coachInTeam) {
        const { club } = coachInTeam;
        return {
          type: OrganizationType.Club,
          role: OrganizationRole.Coach,
          id: club.id,
          name: club.name,
          logo: club.logo,
        };
      }
    }

    return null;
  }

  async getUserChild(userId?: string): Promise<UserChild | null> {
    if (userId) {
      const { Item } = await this.dynamoHelper.getItem(`user#${userId}`, 'metadata');
      if (Item) {
        return this.getTypeUserChild(Item);
      }
    }

    return null;
  }

  async getChildren(childrenIds: string[]): Promise<UserChild[]> {
    const childrenData: UserChild[] = [];

    if (childrenIds && childrenIds.length) {
      const arrayOfKeys = childrenIds.map((userId: string) => ({
        pk: `user#${userId}`,
        sk: 'metadata',
      }));

      const users = await this.dynamoHelper.batchGet(arrayOfKeys, 'pk', (item) =>
        this.getTypeUserChild(item),
      );

      for (const userId of childrenIds) {
        childrenData.push(users.get(`user#${userId}`));
      }
    }

    return childrenData;
  }

  queryItemsByIndexAndFilter(sk: string, pk: string, indexName: string, ownerUserId: string) {
    const params = {
      TableName: this.tableName,
      IndexName: indexName,
      KeyConditionExpression: 'sk = :sk and begins_with(pk, :pk)',
      FilterExpression: 'ownerUserId = :ownerUserId',
      ExpressionAttributeValues: {
        ':sk': sk,
        ':pk': pk,
        ':ownerUserId': ownerUserId,
      },
    };

    return this.db.query(params).promise();
  }
}

export default UserModel;
