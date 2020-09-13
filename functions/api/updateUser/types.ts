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

export interface UserChild {
  firstName: String;
  lastName: String;
  photo: Image;
}

export interface User {
  email: string;
  firstName: string;
  lastName: string;
  country?: string;
  photo?: Image;
  phone?: string;
  phoneCountry?: string;
  birthDate?: string;
  birthCountry?: string;
  birthCity?: string;
  gender?: Gender;
  usCitizen?: boolean;
  children: UserChild[];
  parent: UserChild | null;
  pendingChildInvitations: ChildInvitation[];
}

export interface ChildInvitation {
  invitationId: string;
  createDate: string;
  user: UserChild;
}
