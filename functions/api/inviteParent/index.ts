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

  const invitationUrl = INVITATION_URL;
  const fullName = `${user.firstName} ${user.lastName}`;
  const photo = user.photo
    ? `https://${IMAGES_DOMAIN}/${user.photo}`
    : `https://${IMAGES_DOMAIN}/email/nophoto.png`;
  const birthDate = formatDate(user.birthDate);
  const childEmail = user.email;

  await sendEmail(email, invitationUrl, fullName, photo, birthDate, childEmail);

  return { errors };
};
