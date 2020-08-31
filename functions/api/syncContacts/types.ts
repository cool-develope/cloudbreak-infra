export enum FieldName {
  syncContacts = 'syncContacts',
  contacts = 'contacts',
}

export interface DBContact {
  pk?: string;
  sk?: string;
  fullName: string;
  photo: string;
  email: string;
}

export interface PhoneContact {
  fullName: string;
  photo: string;
  email: string[];
}

export interface Contact {
  fullName: string;
  photo: string;
  email: string;
}
