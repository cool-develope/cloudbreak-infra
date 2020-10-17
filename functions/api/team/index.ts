// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { Client } from '@elastic/elasticsearch';
// import DynamoHelper from '/opt/nodejs/dynamoHelper';
import { TeamModel } from './common-code/nodejs/models';
import { FieldName, FunctionEvent, FunctionEventBatch } from './common-code/nodejs/types/team';

const { MAIN_TABLE_NAME = '', IMAGES_DOMAIN = '', ES_DOMAIN } = process.env;
const db = new AWS.DynamoDB.DocumentClient();
const es = new Client({ node: ES_DOMAIN });

export const handler: Handler = async (
  event: FunctionEvent | FunctionEventBatch[],
): Promise<any> => {
  const teamModel = new TeamModel(db, MAIN_TABLE_NAME, IMAGES_DOMAIN, uuidv4, es);
  console.log(JSON.stringify(event, null, 2));

  if (Array.isArray(event)) {
    /**
     * Batch
     */
    const field = event[0]?.fieldName as FieldName;

    if (field === FieldName.parentTeam) {
      return await teamModel.getParentTeamBatch(event);
    } else if (field === FieldName.childrenTeams) {
      return await teamModel.getChildrenTeamsBatch(event);
    } else if (field === FieldName.clubTeams) {
      return await teamModel.getClubTeamsBatch(event);
    }
  } else {
    const {
      arguments: { input, teamId, clubId, filter, limit, from },
      identity: { sub },
      info: { fieldName },
    } = event;

    const field = fieldName as FieldName;

    if (field === FieldName.createTeamPrivate) {
      return await teamModel.create(sub, input);
    } else if (field === FieldName.updateTeamPrivate) {
      return await teamModel.update(sub, input);
    } else if (field === FieldName.team) {
      return await teamModel.getById(clubId, teamId);
    } else if (field === FieldName.teamsPrivate) {
      return await teamModel.list(sub, filter, limit, from);
    }
  }

  throw Error('Query not supported');
};
