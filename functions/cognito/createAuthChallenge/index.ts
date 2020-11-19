// @ts-ignore
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import { CognitoUserPoolTriggerHandler } from 'aws-lambda';
import localeService from './localeService';

const {
  SES_FROM_ADDRESS,
  SES_REGION,
  IMAGES_DOMAIN,
  SIGNIN_WEB_URL = '',
  SIGNIN_MOBILE_URL = '',
  SIGNIN_MANAGER_URL = '',
  COGNITO_WEB_CLIENT_ID = '',
  COGNITO_MOBILE_CLIENT_ID = '',
  COGNITO_MANAGER_CLIENT_ID = '',
} = process.env;
AWS.config.update({ region: SES_REGION });
const ses = new AWS.SES();
const EMAIL_TEMPLATE = './signin.html';

const getEmailHtml = (templateFileName: string, data: any) => {
  const html = fs.readFileSync(templateFileName, 'utf8');
  const htmlWithData = Object.keys(data).reduce(
    (acc, key) => acc.replace(new RegExp(`{{ ${key} }}`, 'g'), data[key]),
    html,
  );
  return htmlWithData;
};

const getRandomInteger = (min: number, max: number) =>
  Math.round(Math.random() * (max - min) + min);

const randomDigits = (len: number): string =>
  new Array(len)
    .fill(0)
    .map(() => getRandomInteger(0, 9))
    .join('');

const sendEmail = async (signinUrl: string, emailAddress: string, language: string) => {
  const t = localeService.getFixedT(language);

  const html = getEmailHtml(EMAIL_TEMPLATE, {
    domain: `https://${IMAGES_DOMAIN}`,
    url_signin: signinUrl,
    text1: t('email.signinLine1'),
    text2: t('email.signinLine2'),
    button: t('email.signinButton'),
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
        Data: t('email.signinSubject'),
      },
    },
    Source: SES_FROM_ADDRESS,
  };

  await ses.sendEmail(params).promise();
};

const getSigninUrl = (clientId: string, code: string) => {
  switch (clientId) {
    case COGNITO_MANAGER_CLIENT_ID:
      return `${SIGNIN_MANAGER_URL}?code=${code}`;
    case COGNITO_WEB_CLIENT_ID:
      return `${SIGNIN_WEB_URL}?code=${code}`;
    default:
      return `${SIGNIN_MOBILE_URL}?code=${code}`;
  }
};

export const handler: CognitoUserPoolTriggerHandler = async (event, context) => {
  console.log(JSON.stringify(event, null, 4));

  const {
    callerContext: { clientId },
  } = event;

  let secretLoginCode: string;
  if (!event.request.session || !event.request.session.length) {
    // This is a new auth session
    // Generate a new secret login code and mail it to the user
    secretLoginCode = randomDigits(6);

    const signinUrl = getSigninUrl(clientId, secretLoginCode);
    const language = event.request.userAttributes.locale || 'en';
    await sendEmail(signinUrl, event.request.userAttributes.email, language);
  } else {
    // There's an existing session. Don't generate new digits but
    // re-use the code from the current session. This allows the user to
    // make a mistake when keying in the code and to then retry, rather
    // the needing to e-mail the user an all new code again.
    const previousChallenge = event.request.session.slice(-1)[0];
    secretLoginCode = previousChallenge.challengeMetadata!.match(/CODE-(\d*)/)![1];
  }

  // This is sent back to the client app
  event.response.publicChallengeParameters = {
    email: event.request.userAttributes.email,
  };

  // Add the secret login code to the private challenge parameters
  // so it can be verified by the "Verify Auth Challenge Response" trigger
  event.response.privateChallengeParameters = { secretLoginCode };

  // Add the secret login code to the session so it is available
  // in a next invocation of the "Create Auth Challenge" trigger
  event.response.challengeMetadata = `CODE-${secretLoginCode}`;

  return event;
};
