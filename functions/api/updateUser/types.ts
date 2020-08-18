export enum FieldName {
  updateUser = 'updateUser',
  me = 'me',
}

export enum Gender {
  M,
  F,
}

export interface Image {
  url: string;
}

export interface UpdateUserInput {
  pk?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  photo?: string;
  birthDate?: string;
  birthCountry?: string;
  birthCity?: string;
  gender?: Gender;
  usCitizen?: boolean;
}

export interface User {
  firstName?: string;
  lastName?: string;
  country?: string;
  photo?: Image;
  birthDate?: string;
  birthCountry?: string;
  birthCity?: string;
  gender?: Gender;
  usCitizen?: boolean;
}