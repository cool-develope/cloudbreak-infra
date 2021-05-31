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
  NotificationTeamInvitation,
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

  private getImageUrl(image: string = '') {
    return image ? `https://${this.imagesDomain}/${image}` : '';
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

    const { Item: userData } = await this.dynamoHelper.getItem(`user#${userId}`, 'metadata');
    const { parentUserId } = userData;

    const pk = `team#${teamId}`;
    const sk = `user#${userId}`;
    const teamUser = await this.getTeamUser(pk, sk);
    const teamDetails = await this.getTeam(clubId, teamId);
    const teamUserExists = !!teamUser;

    if (teamUserExists) {
      errors.push('Invitation already exists');
    } else {
      let eventName = 'SendTeamInvitation';
      let parentSub = null;
      let data: TeamUserRecord = {
        role,
        createdAt: new Date().toISOString(),
        status: TeamInvitationStatus.Pending,
        clubId,
      };

      if (parentUserId) {
        // this is a Child
        eventName = 'ChildSendTeamInvitation';
        parentSub = parentUserId;
        data.status = TeamInvitationStatus.PendingParentApproval;
      }

      await this.dynamoHelper.updateItem(pk, sk, data);
      await this.putEvents(eventName, {
        sub: userId,
        parentSub,
        childFirstName: userData.firstName,
        childLastName: userData.lastName,
        childPhoto: this.getImageUrl(userData.photo),
        teamId,
        clubId,
        teamName: teamDetails?.name || '',
        teamLogo: teamDetails?.logo || '',
        role,
      });
    }

    return {
      errors,
    };
  }

  async addParentToTeam(clubId: string, teamId: string, userId: string, teamDetails: any) {
    const { Item: userData } = await this.dynamoHelper.getItem(`user#${userId}`, 'metadata');
    const { parentUserId } = userData;
    if (parentUserId) {
      // I have a parent
      const pk = `team#${teamId}`;
      const sk = `user#${parentUserId}`;
      const { Item: team } = await this.dynamoHelper.getItem(pk, sk);

      if (team && team.status === TeamInvitationStatus.Accepted) {
        // Parent already accepted to the team
        return;
      } else {
        // Add or accept parent
        const data: TeamUserRecord = {
          role: TeamMemberType.Member,
          createdAt: new Date().toISOString(),
          status: TeamInvitationStatus.Accepted,
          clubId,
        };

        try {
          await this.dynamoHelper.updateItem(pk, sk, data);

          await this.putEvents('AcceptTeamInvitation', {
            sub: parentUserId,
            teamId,
            clubId,
            teamName: teamDetails?.name,
            teamLogo: teamDetails?.logo,
            role: TeamMemberType.Member,
          });

          console.log('addParentToTeam', {
            userId,
            parentUserId,
            clubId,
            teamId,
          });
        } catch (err) {
          console.error('addParentToTeam', err);
        }
      }
    }
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
    } else if (
      teamUser.status === TeamInvitationStatus.Pending ||
      teamUser.status === TeamInvitationStatus.Declined
    ) {
      const data = {
        status: TeamInvitationStatus.Accepted,
      };
      await this.dynamoHelper.updateItem(pk, sk, data);
      await this.putEvents('AcceptTeamInvitation', {
        sub: userId,
        teamId,
        clubId,
        teamName: teamDetails?.name || '',
        teamLogo: teamDetails?.logo || '',
        role: teamUser.role,
      });

      await this.addParentToTeam(clubId, teamId, userId, teamDetails);
    } else if (teamUser.status === TeamInvitationStatus.Accepted) {
      errors.push('Invitation already accepted');
    } else if (teamUser.status === TeamInvitationStatus.PendingParentApproval) {
      errors.push('Waiting for parent approval');
    }

    return {
      errors,
    };
  }

  async approveTeamInvitationByParent(sub: string, input: AcceptTeamInvitationPrivateInput) {
    const errors: string[] = [];
    const { userId, clubId, teamId } = input;
    const pk = `team#${teamId}`;
    const sk = `user#${userId}`;
    const teamUser = await this.getTeamUser(pk, sk);
    const teamDetails = await this.getTeam(clubId, teamId);

    if (teamUser?.status === TeamInvitationStatus.PendingParentApproval) {
      const data = {
        status: TeamInvitationStatus.Pending,
      };
      await this.dynamoHelper.updateItem(pk, sk, data);
      await this.putEvents('ApproveTeamInvitationByParent', {
        sub: userId,
        parentSub: sub,
        teamId,
        clubId,
        teamName: teamDetails?.name || '',
        teamLogo: teamDetails?.logo || '',
        role: teamUser.role,
      });
    } else {
      errors.push('Invalid invitation');
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
    } else if (
      teamUser.status === TeamInvitationStatus.Pending ||
      teamUser.status === TeamInvitationStatus.Accepted
    ) {
      const data = {
        status: TeamInvitationStatus.Declined,
      };
      await this.dynamoHelper.updateItem(pk, sk, data);
      await this.putEvents('DeclineTeamInvitation', {
        sub: userId,
        teamId,
        clubId,
        teamName: teamDetails?.name || '',
        teamLogo: teamDetails?.logo || '',
        role: teamUser.role,
      });
    } else if (teamUser.status === TeamInvitationStatus.Declined) {
      errors.push('Invitation already declined');
    }

    return {
      errors,
    };
  }

  async rejectTeamInvitationByParent(sub: string, input: DeclineTeamInvitationPrivateInput) {
    const errors: string[] = [];
    const { userId, clubId, teamId } = input;
    const pk = `team#${teamId}`;
    const sk = `user#${userId}`;
    const teamUser = await this.getTeamUser(pk, sk);
    const teamDetails = await this.getTeam(clubId, teamId);

    if (teamUser?.status === TeamInvitationStatus.PendingParentApproval) {
      const data = {
        status: TeamInvitationStatus.ParentRejected,
      };
      await this.dynamoHelper.updateItem(pk, sk, data);
      await this.putEvents('RejectTeamInvitationByParent', {
        sub: userId,
        parentSub: sub,
        teamId,
        clubId,
        teamName: teamDetails?.name || '',
        teamLogo: teamDetails?.logo || '',
        role: teamUser.role,
      });
    } else {
      errors.push('Invalid invitation');
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
      teamName: teamDetails?.name || '',
      teamLogo: teamDetails?.logo || '',
      fromRole: teamUser?.role,
      toRole: role,
    });
  }

  putEvents(type: string, detail: NotificationTeamInvitation) {
    const params = {
      Entries: [
        {
          Source: 'cloudbreak.api',
          EventBusName: 'default',
          Time: new Date(),
          DetailType: type,
          Detail: JSON.stringify(detail),
        },
      ],
    };

    return this.eventbridge.putEvents(params).promise();
  }
}

export default TeamInvitationModel;
