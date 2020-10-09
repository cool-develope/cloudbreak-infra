import DynamoHelper from '../dynamoHelper';
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
} from '../types/club';

class ClubModel {
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

  async create(userId: string, input: UpdateClubPrivateInput): Promise<UpdateClubPrivatePayload> {
    return this.update(userId, input);
  }

  async update(userId: string, input: UpdateClubPrivateInput): Promise<UpdateClubPrivatePayload> {
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

    const pk = id ? `club#${id}` : `club#${this.uuidv4()}`;
    const defaultValues = id ? null : this.getDefaultValues(userId);

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

    return {
      errors: [],
      club: this.getTypeClub(Attributes),
    };
  }

  async getById(clubId: string): Promise<Club | null> {
    const pk = `club#${clubId}`;
    const { Item } = await this.dynamoHelper.getItem(pk, 'metadata');
    return this.getTypeClub(Item);
  }

  async list(
    userId: string,
    filter: ClubsFilterInput = {},
    limit: number = 10,
    from: number = 0,
  ): Promise<ClubsConnection> {
    const query = this.getEsQuery(userId, filter);
    const esResult = await this.esSearch({ query, limit, from });

    const totalCount = esResult.body?.hits.total.value || 0;
    const items = this.prepareEsItems(esResult.body?.hits.hits);

    return {
      items: items.map((item) => this.getTypeClub(item)),
      totalCount,
    };
  }

  getTypeClub({
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
    ciCount = 0,
    miCount = 0,
  }: ClubRecord): Club {
    return {
      id: pk.replace('club#', ''),
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
      upcomingEventsCount: 1,
      coacheInvitationsCount: ciCount || 0,
      memberInvitationsCount: miCount || 0,
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
      ciCount: 0,
      miCount: 0,
    };
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

  getEsQuery(userId: string, filter: ClubsFilterInput = {}) {
    const { search = '', city = '', discipline = [], clubIds } = filter;

    const filterBySearch = this.getEsQueryBySearch(search);
    const filterByCity = this.getEsQueryByMatch('city', city);
    const filterById = this.getEsQueryByArray('_id', clubIds);
    const filterByDiscipline = this.getEsQueryByDiscipline(discipline);

    const must = [filterBySearch, filterByCity, filterByDiscipline, filterById].filter((f) => !!f);

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
        index: 'clubs',
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

export default ClubModel;
