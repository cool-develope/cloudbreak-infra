// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import { FieldName, PhoneContact, Contact, DBContact } from './types';

const db = new AWS.DynamoDB.DocumentClient();
const { MAIN_TABLE_NAME = '' } = process.env;
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

const batchPut = async (pk: string, contacts: DBContact[]) => {
  /**
   * Create Put request for each contact
   */
  const putRequests = contacts.map(({ email = '', fullName = '', photo = '' }) => ({
    PutRequest: {
      Item: {
        pk,
        sk: `${CONTACT_SK_PREFIX}${email}`,
        fullName,
        photo,
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

const findContacts = async (phoneContacts: PhoneContact[]) => {
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
          ':email': email,
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
  const contacts = [];
  for (const result of results) {
    for (const item of result.Items) {
      const { pk, email } = item;
      const contact = phoneContacts.find((contact) => contact.email.includes(email));

      if (contact) {
        contacts.push({ ...contact, email });
      }
    }
  }

  /**
   * Return only existing contacts
   */
  return contacts;
};

const getContacts = (pk: string, isConsistentRead: boolean) => {
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

const getTypeContact = ({ fullName, photo, email }: DBContact): Contact => ({
  fullName,
  photo,
  email,
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
  const contactResult = await getContacts(pk, isConsistentRead);

  const result = contactResult.Items.map((item: DBContact) => getTypeContact(item));
  console.log('RESULT: ', result);

  return result;
};
