// @ts-ignore
import * as AWS from 'aws-sdk';
import { EventBridgeHandler } from 'aws-lambda';
import DynamoHelper from './dynamoHelper';
import CognitoHelper, { CognitoGroup } from './cognitoHelper';
import { NotificationType, TeamMemberType } from './types';

const {
  MAIN_TABLE_NAME = '',
  IMAGES_DOMAIN = '',
  ES_DOMAIN,
  COGNITO_USERPOOL_ID = '',
} = process.env;

const db = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamoHelper = new DynamoHelper(db, MAIN_TABLE_NAME);

export const handler: EventBridgeHandler<any, any, any> = async (event) => {
  const { detail } = event;
  const type = event['detail-type'];
  console.log(type, detail);

  const { sub, teamId, clubId, teamName, role } = detail;
  const cognitoHelper = new CognitoHelper(cognito, COGNITO_USERPOOL_ID, sub);

  switch (type) {
    case NotificationType.SendTeamInvitation:
      break;

    case NotificationType.DeclineTeamInvitation:
      /**
       * TODO - leave other clubs and teams
       * TODO - leave in group if can
       */
      if (role === TeamMemberType.Coach) {
        // await cognitoHelper.removeClub(clubId);
        // await cognitoHelper.removeTeam(teamId);
        await cognitoHelper.removeUserFromGroup(CognitoGroup.ClubCoaches);
      }
      break;

    case NotificationType.AcceptTeamInvitation:
      /**
       * Add user to Cognito Group
       * Add clubId/teamId to Cognito
       */
      if (role === TeamMemberType.Coach) {
        // await cognitoHelper.addClub(clubId);
        // await cognitoHelper.addTeam(teamId);
        await cognitoHelper.addUserToGroup(CognitoGroup.ClubCoaches);
      }
      break;
  }
};
