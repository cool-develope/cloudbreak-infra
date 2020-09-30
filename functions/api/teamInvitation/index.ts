// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { Client } from '@elastic/elasticsearch';
import { TeamInvitationModel } from './common-code/nodejs/models';
import { FieldName, FunctionEvent } from './common-code/nodejs/types/teamInvitation';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN = '', ES_DOMAIN } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });

export const handler: Handler = async (event: FunctionEvent): Promise<any> => {
  const {
    arguments: { input },
    identity: { sub },
    info: { fieldName },
  } = event;

  console.log(JSON.stringify(event, null, 2));
  const field = fieldName as FieldName;

  const teamInvitationModel = new TeamInvitationModel(
    db,
    MAIN_TABLE_NAME,
    IMAGES_DOMAIN,
    uuidv4,
    es,
  );

  if (field === FieldName.sendTeamInvitation) {
    return await teamInvitationModel.sendInvitation(sub, input);
  } else if (field === FieldName.acceptTeamInvitationPrivate) {
    return await teamInvitationModel.acceptInvitation(sub, input);
  } else if (field === FieldName.declineTeamInvitationPrivate) {
    return await teamInvitationModel.declineInvitation(sub, input);
  }

  throw Error('Query not supported');
};
