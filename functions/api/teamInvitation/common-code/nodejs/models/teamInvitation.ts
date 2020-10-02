import { error } from 'console';
import DynamoHelper from '../dynamoHelper';
import {
  TeamUserRecord,
  TeamMemberType,
  TeamInvitationStatus,
  SendTeamInvitationInput,
  AcceptTeamInvitationPrivateInput,
  DeclineTeamInvitationPrivateInput,
  SendTeamInvitationPayload,
} from '../types/teamInvitation';

class TeamInvitationModel {
  private readonly es: any;
  private readonly db: any;
  private readonly tableName: string;
  private readonly dynamoHelper: DynamoHelper;
  private readonly imagesDomain: string;
  private readonly uuidv4: () => string;

  constructor(db: any, tableName: string, imagesDomain: string, uuidv4: () => string, es: any) {
    this.es = es;
    this.db = db;
    this.tableName = tableName;
    this.imagesDomain = imagesDomain;
    this.dynamoHelper = new DynamoHelper(this.db, this.tableName);
    this.uuidv4 = uuidv4;
  }

  async getTeamUser(pk: string, sk: string): Promise<TeamUserRecord | null> {
    const { Item } = await this.dynamoHelper.getItem(pk, sk);
    return Item;
  }

  async incrementInvitationsCount(
    clubId: string,
    teamId: string,
    role: TeamMemberType,
    isDecrement: boolean = false,
  ) {
    const fieldName = role === TeamMemberType.Coach ? 'ciCount' : 'miCount';
    const pk = `club#${clubId}`;
    const skClub = `metadata`;
    const skTeam = `team#${teamId}`;

    await this.dynamoHelper.incrementField(pk, skClub, fieldName, 1, isDecrement);
    await this.dynamoHelper.incrementField(pk, skTeam, fieldName, 1, isDecrement);
  }

  async sendInvitation(
    userId: string,
    input: SendTeamInvitationInput,
  ): Promise<SendTeamInvitationPayload> {
    const errors: string[] = [];
    const { clubId, teamId, role } = input;

    /**
     * TODO - send notification to club owner
     */

    const pk = `team#${teamId}`;
    const sk = `user#${userId}`;
    const teamUser = await this.getTeamUser(pk, sk);
    const teamUserExists = !!teamUser;

    if (teamUserExists) {
      errors.push('Invitation already exists');
    } else {
      const data: TeamUserRecord = {
        role,
        createdAt: new Date().toISOString(),
        status: TeamInvitationStatus.Pending,
        clubId,
      };
      await this.dynamoHelper.updateItem(pk, sk, data);
      await this.incrementInvitationsCount(clubId, teamId, role);
    }

    return {
      errors,
    };
  }

  async acceptInvitation(
    sub: string,
    input: AcceptTeamInvitationPrivateInput,
  ): Promise<SendTeamInvitationPayload> {
    const errors: string[] = [];
    const { userId, clubId, teamId } = input;
    const pk = `team#${teamId}`;
    const sk = `user#${userId}`;
    const teamUser = await this.getTeamUser(pk, sk);

    if (!teamUser) {
      errors.push('Invitation not found');
    } else if (teamUser.status === TeamInvitationStatus.Accepted) {
      errors.push('Invitation already accepted');
    } else {
      const data = {
        status: TeamInvitationStatus.Accepted,
      };
      await this.dynamoHelper.updateItem(pk, sk, data);
      await this.incrementInvitationsCount(clubId, teamId, teamUser.role, true);
    }

    return {
      errors,
    };
  }

  async declineInvitation(
    sub: string,
    input: DeclineTeamInvitationPrivateInput,
  ): Promise<SendTeamInvitationPayload> {
    const errors: string[] = [];
    const { userId, clubId, teamId } = input;
    const pk = `team#${teamId}`;
    const sk = `user#${userId}`;
    const teamUser = await this.getTeamUser(pk, sk);

    if (!teamUser) {
      errors.push('Invitation not found');
    } else if (teamUser.status === TeamInvitationStatus.Declined) {
      errors.push('Invitation already declined');
    } else {
      const data = {
        status: TeamInvitationStatus.Declined,
      };
      await this.dynamoHelper.updateItem(pk, sk, data);
      await this.incrementInvitationsCount(clubId, teamId, teamUser.role, true);
    }

    return {
      errors,
    };
  }
}

export default TeamInvitationModel;
