import { UserProps } from '@aws-cdk/aws-iam';
import { TeamMember } from 'functions/api/updateUser/types';
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
    const field = event[0]?.fieldName as FieldName;
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
    const esResult = await this.esSearch({ query, limit, from });

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

        result.push({
          club: clubShort,
          team: teamShort,
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
    parentUserId,
  }: any): Promise<UserPrivate> {
    const teamsDetails = await this.getTeamMemberDetails(id, teams);
    const parent = parentUserId ? await this.getById(parentUserId) : null;

    const user = {
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
      createDate: createdAt,
      parent,
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
                match: {
                  firstName: search,
                },
              },
              {
                match: {
                  lastName: search,
                },
              },
              {
                match: {
                  email: search,
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

  getEsQueryList(userId: string, filter: UsersFilter = {}) {
    const { search, clubIds, teamIds, role, status } = filter;
    const roles = role ? [role] : [];
    const statuses = status ? [status] : [];

    const filterBySearch = this.getEsQueryBySearch(search);
    const filterByTeams = this.getEsQueryTeamsArray('should', 'teamId', teamIds);
    const filterByClubs = this.getEsQueryTeamsArray('should', 'clubId', clubIds);
    const filterByRole = this.getEsQueryTeamsArray('must', 'role', roles);
    const filterByStatus = this.getEsQueryTeamsArray('must', 'status', statuses);
    const must = [
      filterBySearch,
      filterByTeams,
      filterByClubs,
      filterByRole,
      filterByStatus,
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
        index: 'users',
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
}

export default UserModel;
