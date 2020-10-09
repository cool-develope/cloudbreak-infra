// @ts-ignore
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import { Handler } from 'aws-lambda';

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN,
  ES_DOMAIN,
  SES_FROM_ADDRESS,
  SES_REGION,
  INVITATION_URL = '',
} = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const eventbridge = new AWS.EventBridge();
const ses = new AWS.SES({ region: SES_REGION });
const EMAIL_TEMPLATE = './child-invitation.html';

const getEmailHtml = (templateFileName: string, data: any) => {
  const html = fs.readFileSync(templateFileName, 'utf8');
  const htmlWithData = Object.keys(data).reduce(
    (acc, key) => acc.replace(new RegExp(`{{ ${key} }}`, 'g'), data[key]),
    html,
  );
  return htmlWithData;
};

const sendEmail = async (
  emailAddress: string,
  invitationUrl: string,
  fullName: string,
  photo: string,
  birthDate: string,
  childEmail: string,
) => {
  const html = getEmailHtml(EMAIL_TEMPLATE, {
    domain: `https://${IMAGES_DOMAIN}`,
    photo,
    url_invite: invitationUrl,
    text1: 'Are you the parent of this child?',
    text2: 'Date of birth',
    text3: 'Email',
    text4: 'This link will expire in 15 minutes and can only be used once.',
    button: 'Check in app',
    fullName,
    birth: birthDate,
    email: childEmail,
  });

  const params: AWS.SES.SendEmailRequest = {
    Destination: { ToAddresses: [emailAddress] },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: html,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: `${fullName} invites you as a parent`,
      },
    },
    Source: SES_FROM_ADDRESS,
  };

  await ses.sendEmail(params).promise();
};

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

const getUpdateExpression = (attributes: any = {}) =>
  Object.keys(attributes)
    .map((key) =>
      attributes[key] !== undefined && attributes[key] !== null ? `${key} = :${key}` : null,
    )
    .filter((attr) => !!attr)
    .join(', ');

const getExpressionAttributeValues = (attributes = {}) => {
  const obj: any = {};
  Object.entries(attributes).forEach(([key, value]) =>
    value !== undefined && value !== null ? (obj[`:${key}`] = value) : null,
  );
  return obj;
};

const updateItem = (pk: string, sk: string, attributes: any) => {
  const condition = 'SET ' + getUpdateExpression(attributes);
  const values = getExpressionAttributeValues(attributes);

  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: { pk, sk },
    UpdateExpression: condition,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  };

  return db.update(params).promise();
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

const formatDate = (str: string) => {
  const d = new Date(str || Date.now());
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export const handler: Handler = async (event): Promise<{ errors: string[] }> => {
  const {
    arguments: {
      input: { email },
    },
    identity: { sub },
    info: { fieldName },
  } = event;

  /**
   * TODO: Move to EventBridge
   * TODO: Check other pending invitations from me - disable them
   * TODO: Validate email
   * TODO: Check invitation frequency (5/hour)
   */

  const errors: string[] = [];
  const pk = `invitation#${email}`;
  const sk = `child#${sub}`;
  const data = {
    createdAt: new Date().toISOString(),
    modifiedAt: '',
    inviteStatus: 'pending',
  };

  await updateItem(pk, sk, data);
  const { Item: user } = await getItem(`user#${sub}`, 'metadata');
  const { Items: parents } = await scanItems('user#', 'metadata', email);
  const [parentUser] = parents;
  const parentSub = parentUser ? parentUser.pk.replace('user#', '') : null;

  const invitationUrl = INVITATION_URL;
  const fullName = `${user.firstName} ${user.lastName}`;
  const photo = user.photo
    ? `https://${IMAGES_DOMAIN}/${user.photo}`
    : `https://${IMAGES_DOMAIN}/email/nophoto.png`;
  const birthDate = formatDate(user.birthDate);
  const childEmail = user.email;

  await sendEmail(email, invitationUrl, fullName, photo, birthDate, childEmail);

  await putEvents('InviteParent', {
    invitationUrl,
    childSub: sub,
    childEmail: childEmail,
    childFirstName: user.firstName,
    childLastName: user.lastName,
    childPhoto: photo,
    childBirthDate: birthDate,
    childParentSub: parentSub,
    parentEmail: email,
  });

  return { errors };
};
