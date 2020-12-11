// @ts-ignore
import * as AWS from 'aws-sdk';
import * as OneSignal from 'onesignal-node';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import DynamoHelper from './dynamoHelper';

enum FieldName {
  sendMoneyRequest = 'sendMoneyRequest',
  rejectMoneyRequest = 'rejectMoneyRequest',
  moneyRequests = 'moneyRequests',
}

enum MoneyRequestStatus {
  Pending = 'Pending',
  Paid = 'Paid',
  Rejected = 'Rejected',
}

interface MoneyRequest {
  id: string;
  amount: number;
  note: string;
  status: string;
  createDate: string;
  user: UserPublic;
  fromMe: boolean;
}

interface Image {
  url: string;
}

interface UserPublic {
  id: string;
  firstName?: string;
  lastName?: string;
  photo?: Image;
}

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN,
  ES_DOMAIN,
  ONESIGNAL_APP_ID = '',
  ONESIGNAL_API_KEY = '',
} = process.env;

const db = new AWS.DynamoDB.DocumentClient();
const eventbridge = new AWS.EventBridge();
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);

const putEvents = (type: string, detail: any) => {
  const params = {
    Entries: [
      {
        Source: 'tifo.api',
        EventBusName: 'default',
        Time: new Date(),
        DetailType: type,
        Detail: JSON.stringify(detail),
      },
    ],
  };

  console.log(type, detail);
  return eventbridge.putEvents(params).promise();
};

const getDeviceIds = async (pk: string) => {
  const getResult = await getItem(pk, 'devices');
  if (getResult.Item && getResult.Item.ids) {
    return getResult.Item.ids.values.filter((id: string) => uuidValidate(id));
  }

  return [];
};

const getAllMoneyRequests = (userId: string, status: MoneyRequestStatus) => {
  const sk = 'metadata';
  const pk = 'money-request#';

  const params = {
    TableName: MAIN_TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'sk = :sk and begins_with(pk, :pk)',
    FilterExpression: '(senderUserId = :userId or recipientUserId = :userId) and #status = :status',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':sk': sk,
      ':pk': pk,
      ':userId': userId,
      ':status': status,
    },
  };

  return db.query(params).promise();
};

const scanItems = (pk: string, sk: string, email: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    FilterExpression: 'begins_with(pk, :pk) and sk = :sk and email = :email',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': sk,
      ':email': email,
    },
  };

  return db.scan(params).promise();
};

const getItem = (pk: string, sk: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: { pk, sk },
  };

  return db.get(params).promise();
};

const getImageUrl = (photo: string = '') => (photo ? `https://${IMAGES_DOMAIN}/${photo}` : '');

const getTypeUser = ({ pk, firstName, lastName, photo }: any): UserPublic => ({
  id: pk.replace('user#', ''),
  firstName,
  lastName,
  photo: getTypeImage(photo),
});

const getTypeImage = (photo: string = '') => ({
  url: photo ? `https://${IMAGES_DOMAIN}/${photo}` : '',
});

const sendMoneyRequest = async (sub: string, input: any): Promise<string[]> => {
  const { email, amount, note } = input;

  const { Item: senderUser } = await getItem(`user#${sub}`, 'metadata');
  const { Items: recipients } = await scanItems('user#', 'metadata', email);
  const [recipientUser] = recipients;
  const errors: string[] = [];

  /**
   * TODO: check treezorWalletId/treezorUserId for sender and receiver
   */

  if (!recipientUser) {
    errors.push('Recipient Not Found');
    return errors;
  }

  if (!senderUser.treezorWalletId) {
    errors.push("You don't have a wallet");
    return errors;
  }

  if (!recipientUser.treezorWalletId) {
    errors.push("Recipient don't have a wallet");
    return errors;
  }

  const senderUserId = sub;
  const requestId = uuidv4();
  const recipientUserId = recipientUser.pk.replace('user#', '');
  const requestPk = `money-request#${requestId}`;
  const requestSk = 'metadata';

  await dynamoHelper.updateItem(requestPk, requestSk, {
    amount,
    note,
    status: MoneyRequestStatus.Pending,
    createdAt: new Date().toISOString(),
    senderUserId,
    recipientUserId,
  });

  await putEvents('SendMoneyRequest', {
    requestId,
    senderSub: senderUserId,
    senderEmail: senderUser.email,
    senderFirstName: senderUser.firstName,
    senderLastName: senderUser.lastName,
    senderPhoto: getImageUrl(senderUser.photo),
    senderWalletId: senderUser.treezorWalletId,
    recipientSub: recipientUserId,
    recipientEmail: recipientUser.email,
    recipientFirstName: recipientUser.firstName,
    recipientLastName: recipientUser.lastName,
    amount,
    note,
  });

  return errors;
};

const rejectMoneyRequest = async (sub: string, input: any) => {
  const { requestId } = input;
  const errors: string[] = [];
  const pk = `money-request#${requestId}`;
  const sk = 'metadata';

  const { Item } = await dynamoHelper.getItem(pk, sk);
  if (Item) {
    const { recipientUserId, senderUserId } = Item;
    const haveAccess = sub === recipientUserId || sub === senderUserId;
    if (haveAccess) {
      await dynamoHelper.updateItem(pk, sk, { status: MoneyRequestStatus.Rejected });
      await putEvents('RejectMoneyRequest', {
        requestId,
        senderSub: senderUserId,
        recipientSub: recipientUserId,
      });
    } else {
      console.error('Access Denied', {
        sub,
        requestId,
      });
      errors.push('Access Denied');
    }
  } else {
    errors.push('This money request not exists');
  }

  return errors;
};

const moneyRequests = async (sub: string, filter: any = {}): Promise<MoneyRequest[]> => {
  const { status } = filter;
  const { Items } = await getAllMoneyRequests(sub, status || MoneyRequestStatus.Pending);
  const resultItems: MoneyRequest[] = [];

  for (const item of Items) {
    /**
     * Sergey to Alex - sender=Sergey, recipien=Alex
     * Alex to Sergey - sender=Alex, recipien=Sergey
     *
     * Alex see (Sergey to Alex) - user=sender
     * Alex see (Alex to Sergey) - user=recipien
     *
     * Sergey see (Sergey to Alex) - user=recipien
     * Sergey see (Alex to Sergey) - user=sender
     */

    const { recipientUserId, senderUserId } = item;
    const fromMe = item.senderUserId === sub;
    const userId = fromMe ? recipientUserId : senderUserId;
    const { Item: userData } = await dynamoHelper.getItem(`user#${userId}`, 'metadata');

    resultItems.push({
      id: item.pk.replace('money-request#', ''),
      amount: item.amount,
      note: item.note,
      status: item.status,
      createDate: item.createdAt,
      user: getTypeUser(userData || {}),
      fromMe,
    });
  }

  return resultItems.sort(
    // @ts-ignore
    (a, b) => new Date(b.createDate) - new Date(a.createDate),
  );
};

export const handler: Handler = async (event): Promise<{ errors?: string[]; items?: any[] }> => {
  const {
    arguments: { input, filter },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;

  if (field === FieldName.sendMoneyRequest) {
    const errors = await sendMoneyRequest(sub, input);
    return { errors };
  }
  if (field === FieldName.rejectMoneyRequest) {
    const errors = await rejectMoneyRequest(sub, input);
    return { errors };
  }
  if (field === FieldName.moneyRequests) {
    const items = await moneyRequests(sub, filter);
    return { items };
  }

  throw Error('Query not supported');
};
