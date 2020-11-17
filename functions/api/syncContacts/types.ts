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
  userId: number | null;
  walletId: number | null;
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
  firstName: string;
  lastName: string;
  phone: string;
  birthDate: string;
  gender: string;
  treezor: TreezorUser;
}
