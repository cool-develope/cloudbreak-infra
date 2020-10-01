import DynamoHelper from '../dynamoHelper';
import {
  Image,
  EsUserRecord,
  TeamMemberType,
  TeamInvitationStatus,
  FunctionEventBatch,
  FieldName,
  UserShort,
  UserShortConnection,
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
        this.list(sub, { clubId, role }),
      );

      return await Promise.all(arrayOfPromises);
    } else if (
      field === FieldName.teamCoaches ||
      field === FieldName.teamMembers ||
      field === FieldName.teamFriends
    ) {
      const role = field === FieldName.teamCoaches ? TeamMemberType.Coach : TeamMemberType.Member;
      const arrayOfPromises = event.map(({ source: { id: teamId } }) =>
        this.list(sub, { teamId, role }),
      );

      return await Promise.all(arrayOfPromises);
    }

    throw Error('Not supported query');
  }

  async list(
    userId: string,
    filter: any = {},
    limit: number = 10,
    from: number = 0,
  ): Promise<UserShortConnection> {
    const query = this.getEsQuery(userId, filter);
    const esResult = await this.esSearch({ query, limit, from });

    const totalCount = esResult.body?.hits.total.value || 0;
    const items = this.prepareEsItems(esResult.body?.hits.hits);

    return {
      items: items.map((item) => this.getTypeUserShort(item)),
      totalCount,
    };
  }

  getTypeUserShort({ id, firstName, lastName, photo }: EsUserRecord): UserShort {
    return {
      id,
      name: `${firstName} ${lastName}`,
      logo: this.getTypeImage(photo),
    };
  }

  getTypeImage(image: string | null = ''): Image {
    return {
      url: image ? `https://${this.imagesDomain}/${image}` : '',
    };
  }

  prepareEsItems(items: any[] = []) {
    return items.map(({ _id, _source }) => ({ id: _id, ..._source }));
  }

  getEsQueryBySearch(search: string) {
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
    const must = [];

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

  getEsQuery(userId: string, filter: any = {}) {
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
}

export default UserModel;
