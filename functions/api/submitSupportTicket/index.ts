// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

const { MAIN_TABLE_NAME = '', SES_FROM_ADDRESS, SES_REGION } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES({ region: SES_REGION });

const sendEmail = async (email: string, fullName: string, type: string, message: string) => {
  const html = `
  <b>From:</b> ${fullName}, ${email}<br /><br />
  <b>Message:</b><br />
  ${message}<br />`;

  const params: AWS.SES.SendEmailRequest = {
    Destination: { ToAddresses: ['tifo@tifo-sport.com'] },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: html,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: `${type} ticket`,
      },
    },
    ReplyToAddresses: [email],
    Source: SES_FROM_ADDRESS,
  };

  await ses.sendEmail(params).promise();
};

const getItem = (pk: string, sk: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: { pk, sk },
  };

  return db.get(params).promise();
};

export const handler: Handler = async (event): Promise<{ errors: string[] }> => {
  const {
    arguments: {
      input: { type, message },
    },
    identity: { sub },
    info: { fieldName },
  } = event;

  const errors: string[] = [];
  const pk = `user#${sub}`;
  const sk = 'metadata';

  const { Item: user } = await getItem(pk, sk);

  const { firstName, lastName, email } = user;
  const fullName = `${firstName} ${lastName}`;

  await sendEmail(email, fullName, type, message);

  return { errors };
};
