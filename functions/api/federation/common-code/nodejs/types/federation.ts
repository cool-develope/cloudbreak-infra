export enum FieldName {
  createFederationPrivate = 'createFederationPrivate',
  updateFederationPrivate = 'updateFederationPrivate',
  federationsPrivate = 'federationsPrivate',
  federation = 'federation',
}

export enum Discipline {
  FOOTBALL = 'FOOTBALL',
  TENNIS = 'TENNIS',
  PADEL = 'PADEL',
  BASKETBALL = 'BASKETBALL',
  VOLLEYBALL = 'VOLLEYBALL',
  ATHLETICS = 'ATHLETICS',
  ROWING = 'ROWING',
  BADMINTON = 'BADMINTON',
  BOXING = 'BOXING',
  CANOE_KAYAK = 'CANOE_KAYAK',
  CYCLING = 'CYCLING',
  GOLF = 'GOLF',
  GYMNASTIC = 'GYMNASTIC',
  HANDBALL = 'HANDBALL',
  JUDO = 'JUDO',
  SWIMMING = 'SWIMMING',
  RUGBY = 'RUGBY',
  EQUESTRIAN = 'EQUESTRIAN',
  TAEKWONDO = 'TAEKWONDO',
  TABLE_TENNIS = 'TABLE_TENNIS',
}

export enum FederationType {
  International = 'International',
  National = 'National',
  Regional = 'Regional',
  Local = 'Local',
}

export interface Image {
  url: string;
}

export interface FederationRecord {
  pk?: string;
  sk?: string;
  name?: string;
  description?: string;
  cover?: string;
  logo?: string;
  email?: string;
  phone?: string;
  address?: string;
  discipline?: string[];
  country?: string;
  city?: string;
  region?: string;
  district?: string;
  ownerUserId?: string;
  createdAt?: string;
  modifiedAt?: string;
  parentId?: string;
  type?: string;
}

export interface Federation {
  id: string;
  name: string;
  description: string;
  cover: Image;
  logo: Image;
  email: string;
  phone: string;
  address: string;
  discipline: string[];
  country: string;
  city: string;
  region: string;
  district: string;
  clubs: ClubShortConnection;
  members: UserShortConnection;
  children: Federation[];
  type: string;
}

export interface UserShort {
  id: string;
  name: string;
  logo: Image;
}

export interface UpdateFederationPrivateInput {
  id?: string;
  name?: string;
  description?: string;
  cover?: string;
  logo?: string;
  email?: string;
  phone?: string;
  address?: string;
  discipline?: string[];
  country?: string;
  city?: string;
  region?: string;
  district?: string;
  parentId?: string;
  type?: FederationType;
}

export interface UpdateFederationPrivatePayload {
  errors: string[];
  federation: Federation | null;
}

export interface FunctionEvent {
  arguments: {
    input: UpdateFederationPrivateInput;
    filter: FederationsPrivateFilterInput;
    limit?: number;
    from?: number;
    federationId?: string;
  };
  identity: { sub: string };
  info: { fieldName: FieldName };
}

export interface FunctionEventBatch {
  fieldName: FieldName;
  source: any;
  identity: { sub: string; claims: any };
}

export interface FederationConnection {
  items: Federation[];
  totalCount: number;
}

export interface FederationsPrivateFilterInput {
  search?: string;
  discipline?: Discipline[];
  parentId?: string | null;
  isParent?: boolean | null;
}

export interface ClubShortConnection {
  items: ClubShort[];
  totalCount: number;
}

export interface ClubShort {
  id: string;
  name: string;
  logo: Image;
}

export interface UserShortConnection {
  items: UserShort[];
  totalCount: number;
}

export interface UserShort {
  id: string;
  name: string;
  logo: Image;
}
