import * as fs from 'fs';
import { CognitoUserPoolTriggerHandler } from 'aws-lambda';

enum CustomMessage {
  SignUp = 'CustomMessage_SignUp',
  AdminCreateUser = 'CustomMessage_AdminCreateUser',
  ResendCode = 'CustomMessage_ResendCode',
  ForgotPassword = 'CustomMessage_ForgotPassword',
  UpdateUserAttribute = 'CustomMessage_UpdateUserAttribute',
  VerifyUserAttribute = 'CustomMessage_VerifyUserAttribute',
  Authentication = 'CustomMessage_Authentication',
}

const getEmailHtml = (templateFileName: string, data: any) => {
  const html = fs.readFileSync(templateFileName, 'utf8');
  const htmlWithData = Object.keys(data).reduce(
    (acc, key) => acc.replace(new RegExp(`{{ ${key} }}`, 'g'), data[key]),
    html,
  );
  return htmlWithData;
};

const getPayload = (data: any) => Buffer.from(JSON.stringify(data)).toString('base64');

export const handler: CognitoUserPoolTriggerHandler = (event, context, callback) => {
  const { VERIFICATION_URL, RECOVERY_URL } = process.env;
  const {
    codeParameter,
    userAttributes: { email_verified, name },
  } = event.request;
  const { userName } = event;

  const payload = getPayload({ userName });

  if (
    event.triggerSource === CustomMessage.SignUp ||
    event.triggerSource === CustomMessage.ResendCode
  ) {
    const url = `${VERIFICATION_URL}?data=${payload}&code=${codeParameter}`;
    event.response.emailSubject = 'Verify your email';
    event.response.emailMessage = getEmailHtml('./templates/verification.html', {
      firstName: name,
      confimationUrl: url,
    });

    callback(null, event);
  } else if (event.triggerSource === CustomMessage.ForgotPassword) {
    const url = `${RECOVERY_URL}?data=${payload}&code=${codeParameter}`;
    event.response.emailSubject = 'Password Recovery';
    event.response.emailMessage = getEmailHtml('./templates/recovery.html', {
      recoveryUrl: url,
    });

    callback(null, event);
  } else {
    callback(null, event);
  }
};
