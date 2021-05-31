// @ts-ignore
import * as AWS from 'aws-sdk';
import { CognitoUserPoolTriggerHandler } from 'aws-lambda';

export enum CognitoGroup {
  ClubCoaches = 'club-coaches',
  ClubOwners = 'club-owners',
  FederationOwners = 'federation-owners',
  cloudbreakManager = 'cloudbreak-manager',
}

interface ListGroupsForUser {
  Groups: { GroupName: string }[] | null;
}

const {
  COGNITO_WEB_CLIENT_ID = '',
  COGNITO_MOBILE_CLIENT_ID = '',
  COGNITO_MANAGER_CLIENT_ID = '',
} = process.env;

const cognito = new AWS.CognitoIdentityServiceProvider();

const getGroups = async (userPoolId: string, sub: string): Promise<string[]> => {
  const params = {
    UserPoolId: userPoolId,
    Username: sub,
  };

  const data: ListGroupsForUser = await cognito.adminListGroupsForUser(params).promise();

  if (data && data.Groups && data.Groups.length) {
    return data.Groups.map(({ GroupName }) => GroupName);
  }

  return [];
};

const canLoginToWeb = async (userPoolId: string, sub: string) => {
  const groups = await getGroups(userPoolId, sub);
  const allowed =
    groups.includes(CognitoGroup.ClubCoaches) ||
    groups.includes(CognitoGroup.ClubOwners) ||
    groups.includes(CognitoGroup.FederationOwners) ||
    groups.includes(CognitoGroup.cloudbreakManager);
  // console.log('canLoginToWeb', groups, allowed);

  return allowed;
};

const canLoginToManage = async (userPoolId: string, sub: string) => {
  const groups = await getGroups(userPoolId, sub);
  const allowed = groups.includes(CognitoGroup.cloudbreakManager);
  // console.log('canLoginToManage', groups, allowed);
  return allowed;
};

const accessAllowed = async (clientId: string, userPoolId: string, sub: string) => {
  if (clientId === COGNITO_MOBILE_CLIENT_ID) {
    return true;
  } else if (clientId === COGNITO_WEB_CLIENT_ID) {
    return await canLoginToWeb(userPoolId, sub);
  } else if (clientId === COGNITO_MANAGER_CLIENT_ID) {
    return await canLoginToManage(userPoolId, sub);
  }

  return false;
};

export const handler: CognitoUserPoolTriggerHandler = async (event) => {
  console.log(JSON.stringify(event, null, 4));

  const {
    userPoolId,
    userName = '',
    callerContext: { clientId },
  } = event;

  const allowed = await accessAllowed(clientId, userPoolId, userName);

  if (!allowed) {
    console.log('Access Denied', {
      clientId,
      userPoolId,
      userName,
    });

    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  } else if (
    event.request.session &&
    event.request.session.find((attempt) => attempt.challengeName !== 'CUSTOM_CHALLENGE')
  ) {
    // We only accept custom challenges; fail auth
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  } else if (
    event.request.session &&
    event.request.session.length >= 3 &&
    event.request.session.slice(-1)[0].challengeResult === false
  ) {
    // The user provided a wrong answer 3 times; fail auth
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  } else if (
    event.request.session &&
    event.request.session.length &&
    event.request.session.slice(-1)[0].challengeName === 'CUSTOM_CHALLENGE' && // Doubly stitched, holds better
    event.request.session.slice(-1)[0].challengeResult === true
  ) {
    // The user provided the right answer; succeed auth
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    // The user did not provide a correct answer yet; present challenge
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = 'CUSTOM_CHALLENGE';
  }

  return event;
};
