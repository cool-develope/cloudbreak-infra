// @ts-ignore
import * as AWS from 'aws-sdk';
import { CognitoUserPoolTriggerHandler } from 'aws-lambda';

const { SIGNIN_URL, SES_FROM_ADDRESS, SES_REGION } = process.env;
AWS.config.update({ region: SES_REGION });
const ses = new AWS.SES();

const getRandomInteger = (min: number, max: number) =>
  Math.round(Math.random() * (max - min) + min);

const randomDigits = (len: number): string =>
  new Array(len)
    .fill(0)
    .map(() => getRandomInteger(0, 9))
    .join('');

const SIGNIN_TEMPLATE = `
    <div style="color: #202020; line-height: 1.5;">
          Your email address {{email}} was just used to request<br />a sign in email.
          <div style="padding: 60px 0px;"><a href="{{link}}" style="background-color: #3f51b5; color: #ffffff; padding: 12px 26px; font-size: 18px; border-radius: 28px; text-decoration: none;">Click here to sign in</a></div>
          Code: {{code}}<br /><br />
          If this was not you, you can safely ignore this email.<br /><br />
          Best,<br />
          Tifo`;

const sendEmail = async (emailAddress: string, secretLoginCode: string) => {
  const signinUrl = `${SIGNIN_URL}?code=${secretLoginCode}`;
  const template = SIGNIN_TEMPLATE.replace('{{email}}', emailAddress)
    .replace('{{link}}', signinUrl)
    .replace('{{code}}', secretLoginCode);

  const params: AWS.SES.SendEmailRequest = {
    Destination: { ToAddresses: [emailAddress] },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: template,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: 'Tifo signin',
      },
    },
    Source: SES_FROM_ADDRESS,
  };

  await ses.sendEmail(params).promise();
};

export const handler: CognitoUserPoolTriggerHandler = async (event) => {
  let secretLoginCode: string;
  if (!event.request.session || !event.request.session.length) {
    // This is a new auth session
    // Generate a new secret login code and mail it to the user
    secretLoginCode = randomDigits(6);
    await sendEmail(event.request.userAttributes.email, secretLoginCode);
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
