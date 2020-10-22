export enum FieldName {
  syncContacts = 'syncContacts',
  contacts = 'contacts',
}

export interface Image {
  url: string;
}

export interface DBContact {
  pk: string;
  sk: string;
  email: string;
}

export interface FindResultItem {
  userId: string;
  email: string;
}

export interface TreezorUser {
  userId: number;
  walletId: number;
}

export interface PhoneContact {
  fullName: string;
  photo: string;
  email: string[];
}

export interface Contact {
  id: string;
  fullName: string;
  photo: Image;
  email: string;
  treezor: TreezorUser;
}
