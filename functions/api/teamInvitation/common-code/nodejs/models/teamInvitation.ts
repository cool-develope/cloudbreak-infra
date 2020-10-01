import { error } from 'console';
import DynamoHelper from '../dynamoHelper';
import {
  TeamUserRecord,
  TeamInvitationRecord,
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
    const sk = `invitation#${userId}`;
    const {
      Item: oldInvitation,
    }: { Item: TeamInvitationRecord | null } = await this.dynamoHelper.getItem(pk, sk);
    const exists = !!oldInvitation;

    if (exists) {
      errors.push('Invitation already exists');
    } else {
      const invitation: TeamInvitationRecord = {
        role: role,
        createdAt: new Date().toISOString(),
        status: TeamInvitationStatus.Pending,
        clubId,
      };
      await this.dynamoHelper.updateItem(pk, sk, invitation);
      await this.incrementInvitationsCount(clubId, teamId, role);
    }

    return {
      errors,
    };
  }

  async acceptInvitation(
    userId: string,
    input: AcceptTeamInvitationPrivateInput,
  ): Promise<SendTeamInvitationPayload> {
    const errors: string[] = [];
    const { invitationId, clubId, teamId } = input;
    const pk = `team#${teamId}`;
    const sk = `invitation#${invitationId}`;
    const userSK = `user#${invitationId}`;

    const {
      Item: oldInvitation,
    }: { Item: TeamInvitationRecord | null } = await this.dynamoHelper.getItem(pk, sk);

    if (!oldInvitation) {
      errors.push('Invitation not found');
    } else if (oldInvitation.status === TeamInvitationStatus.Accepted) {
      errors.push('Invitation already accepted');
    } else {
      const userData: TeamUserRecord = {
        role: oldInvitation.role,
        createdAt: new Date().toISOString(),
        clubId,
      };
      await this.dynamoHelper.updateItem(pk, userSK, userData);

      const invitationData = {
        status: TeamInvitationStatus.Accepted,
      };
      await this.dynamoHelper.updateItem(pk, sk, invitationData);
      await this.incrementInvitationsCount(clubId, teamId, oldInvitation.role, true);
    }

    return {
      errors,
    };
  }

  async declineInvitation(
    userId: string,
    input: DeclineTeamInvitationPrivateInput,
  ): Promise<SendTeamInvitationPayload> {
    const errors: string[] = [];
    const { invitationId, clubId, teamId } = input;
    const pk = `team#${teamId}`;
    const sk = `invitation#${invitationId}`;

    const {
      Item: oldInvitation,
    }: { Item: TeamInvitationRecord | null } = await this.dynamoHelper.getItem(pk, sk);

    if (!oldInvitation) {
      errors.push('Invitation not found');
    } else if (oldInvitation.status === TeamInvitationStatus.Declined) {
      errors.push('Invitation already declined');
    } else {
      const invitation = {
        status: TeamInvitationStatus.Declined,
      };

      await this.dynamoHelper.updateItem(pk, sk, invitation);
      await this.incrementInvitationsCount(clubId, teamId, oldInvitation.role, true);
    }

    return {
      errors,
    };
  }
}

export default TeamInvitationModel;
