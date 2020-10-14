import DynamoHelper from '../dynamoHelper';
import {
  TeamUserRecord,
  TeamMemberType,
  TeamInvitationStatus,
  SendTeamInvitationInput,
  AcceptTeamInvitationPrivateInput,
  DeclineTeamInvitationPrivateInput,
  ChangeTeamRolePrivateInput,
  SendTeamInvitationPayload,
  TeamRecord,
} from '../types/teamInvitation';

class TeamInvitationModel {
  private readonly es: any;
  private readonly db: any;
  private readonly eventbridge: any;
  private readonly tableName: string;
  private readonly dynamoHelper: DynamoHelper;
  private readonly imagesDomain: string;
  private readonly uuidv4: () => string;

  constructor(
    db: any,
    tableName: string,
    imagesDomain: string,
    uuidv4: () => string,
    es: any,
    eventbridge: any,
  ) {
    this.es = es;
    this.db = db;
    this.eventbridge = eventbridge;
    this.tableName = tableName;
    this.imagesDomain = imagesDomain;
    this.dynamoHelper = new DynamoHelper(this.db, this.tableName);
    this.uuidv4 = uuidv4;
  }

  async getTeamUser(pk: string, sk: string): Promise<TeamUserRecord | null> {
    const { Item } = await this.dynamoHelper.getItem(pk, sk);
    return Item;
  }

  async getTeam(clubId: string, teamId: string): Promise<TeamRecord | null> {
    const { Item } = await this.dynamoHelper.getItem(`club#${clubId}`, `team#${teamId}`);
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
     * TODO - coach can't be club owner
     */

    const pk = `team#${teamId}`;
    const sk = `user#${userId}`;
    const teamUser = await this.getTeamUser(pk, sk);
    const teamDetails = await this.getTeam(clubId, teamId);
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
      await this.putEvents('SendTeamInvitation', {
        sub: userId,
        teamId,
        clubId,
        teamName: teamDetails?.name,
        role,
      });
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
    const teamDetails = await this.getTeam(clubId, teamId);

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
      await this.putEvents('AcceptTeamInvitation', {
        sub: userId,
        teamId,
        clubId,
        teamName: teamDetails?.name,
        role: teamUser.role,
      });
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
    const teamDetails = await this.getTeam(clubId, teamId);

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
      await this.putEvents('DeclineTeamInvitation', {
        sub: userId,
        teamId,
        clubId,
        teamName: teamDetails?.name,
        role: teamUser.role,
      });
    }

    return {
      errors,
    };
  }

  async changeTeamRole(sub: string, input: ChangeTeamRolePrivateInput) {
    const { userId, clubId, teamId, role } = input;
    const pk = `team#${teamId}`;
    const sk = `user#${userId}`;
    const teamUser = await this.getTeamUser(pk, sk);
    const teamDetails = await this.getTeam(clubId, teamId);

    const data = {
      role,
    };

    await this.dynamoHelper.updateItem(pk, sk, data);
    await this.putEvents('ChangeTeamRole', {
      sub: userId,
      teamId,
      clubId,
      teamName: teamDetails?.name,
      fromRole: teamUser?.role,
      toRole: role,
    });
  }

  putEvents(type: string, detail: any) {
    const params = {
      Entries: [
        {
          Source: 'tifo.api',
          EventBusName: 'default',
          Time: new Date(),
          DetailType: type,
          Detail: JSON.stringify(detail),
        },
      ],
    };

    console.log(type, detail);
    return this.eventbridge.putEvents(params).promise();
  }
}

export default TeamInvitationModel;
