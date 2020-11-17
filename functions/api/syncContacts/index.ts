// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import { FieldName, PhoneContact, Contact, DBContact, FindResultItem } from './types';

const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN, ES_DOMAIN } = process.env;
const CONTACT_SK_PREFIX = 'contact#';

const syncContacts = async (pk: string, phoneContacts: PhoneContact[]) => {
  /**
   * Find contacts
   */
  const contacts = await findContacts(phoneContacts);

  console.log('syncContacts', {
    phoneContacts,
    contacts,
  });

  /**
   * Batch put
   */
  await batchPut(pk, contacts);
};

const batchPut = async (pk: string, contacts: FindResultItem[]) => {
  /**
   * Create Put request for each contact
   */
  const putRequests = contacts.map(({ email, userId }) => ({
    PutRequest: {
      Item: {
        pk,
        sk: `${CONTACT_SK_PREFIX}${userId}`,
        email,
      },
    },
  }));

  /**
   * Split items by batch max size (25)
   */
  const batchLimit = 25;
  const batchParams = [];
  while (putRequests.length) {
    const portionOfPutRequests = putRequests.splice(0, batchLimit);
    batchParams.push({
      RequestItems: {
        [MAIN_TABLE_NAME]: portionOfPutRequests,
      },
    });
  }

  /**
   * Run all batchWrite in parallel by portions
   */
  const arrayOfWrite = batchParams.map((params) => db.batchWrite(params).promise());
  await Promise.all(arrayOfWrite);
};

const getUniqItemsFromArray = (arr: { pk: string; sk: string }[]) => {
  // TODO
  return arr;
};

const batchGet = async (
  arrayOfKeys: { pk: string; sk: string }[],
  idField: string,
  getType: (data: any) => any = (data) => data,
): Promise<Map<string, any>> => {
  const keys = getUniqItemsFromArray(arrayOfKeys);

  /**
   * Split items by batch max size (25)
   */
  const batchLimit = 25;
  const batchParams = [];
  while (keys.length) {
    const portionOfPutRequests = keys.splice(0, batchLimit);
    batchParams.push({
      RequestItems: {
        [MAIN_TABLE_NAME]: {
          Keys: portionOfPutRequests,
        },
      },
    });
  }

  /**
   * Run all batchWrite in parallel by portions
   */
  const arrayOfGet = batchParams.map((params) => db.batchGet(params).promise());
  const res = await Promise.all(arrayOfGet);

  const result = new Map();

  const arrayOfItems = res.map((resItem) => resItem.Responses[MAIN_TABLE_NAME]);
  for (const items of arrayOfItems) {
    for (const item of items) {
      result.set(item[idField], getType(item));
    }
  }

  return result;
};

const findContacts = async (phoneContacts: PhoneContact[]): Promise<FindResultItem[]> => {
  const arrayOfParams = [];

  /**
   * Collect all params for scan requests
   */
  for (const contact of phoneContacts) {
    for (const email of contact.email) {
      arrayOfParams.push({
        TableName: MAIN_TABLE_NAME,
        FilterExpression: 'begins_with(pk, :pk) and sk = :sk and email = :email',
        ExpressionAttributeValues: {
          ':pk': 'user#',
          ':sk': 'metadata',
          ':email': email.toLocaleLowerCase(),
        },
        ProjectionExpression: 'pk, email',
      });
    }
  }

  /**
   * Run all scans in parallel
   */
  const arrayOfScans = arrayOfParams.map((params) => db.scan(params).promise());
  const results = await Promise.all(arrayOfScans);

  /**
   * Compare results with phoneContacts
   */
  const contacts: FindResultItem[] = [];
  for (const result of results) {
    for (const item of result.Items) {
      const { pk, email } = item;
      const contact = phoneContacts.find((contact) => contact.email.includes(email));

      if (contact) {
        contacts.push({ email, userId: pk.replace('user#', '') });
      }
    }
  }

  /**
   * Return only existing contacts
   */
  return contacts;
};

const getContacts = (pk: string, isConsistentRead: boolean): Promise<{ Items: DBContact[] }> => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    KeyConditionExpression: 'pk = :pk and begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': CONTACT_SK_PREFIX,
    },
    ConsistentRead: isConsistentRead,
  };

  return db.query(params).promise();
};

const getTypeImage = (image: string = '') => ({
  url: image ? `https://${IMAGES_DOMAIN}/${image}` : '',
});

const getTypeContact = (user: any): Contact => ({
  id: user.pk.replace('user#', ''),
  fullName: `${user.firstName} ${user.lastName}`,
  firstName: user.firstName,
  lastName: user.lastName,
  photo: getTypeImage(user.photo),
  email: user.email,
  birthDate: user.birthDate,
  gender: user.gender,
  phone: user.phone,
  treezor: {
    userId: user.treezorUserId || null,
    walletId: user.treezorWalletId || null,
  },
});

export const handler: Handler = async (event): Promise<Contact[]> => {
  const {
    arguments: { contacts: phoneContacts },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;
  const pk = `user#${sub}`;

  if (field === FieldName.syncContacts) {
    /**
     * Mutation syncContacts:
     * 1 - find contacts
     * 2 - update contacts
     */
    await syncContacts(pk, phoneContacts);
  } else if (field === FieldName.contacts) {
    /**
     * Query contacts:
     */
  }

  const isConsistentRead = field === FieldName.syncContacts;
  const { Items: contacts } = await getContacts(pk, isConsistentRead);

  const userKeys = contacts.map(({ sk }) => ({
    pk: `user#${sk.replace(CONTACT_SK_PREFIX, '')}`,
    sk: 'metadata',
  }));

  const users = await batchGet(userKeys, 'pk');

  const result = contacts.map((item: DBContact) => {
    const userId = item.sk.replace(CONTACT_SK_PREFIX, '');
    const userPk = `user#${userId}`;
    return getTypeContact(users.get(userPk));
  });

  console.log('RESULT: ', result);
  return result;
};
