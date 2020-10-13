enum CognitoAttributes {
  trzChildren = 'custom:trzChildren',
  trzUserId = 'custom:trzUserId',
  trzScopes = 'custom:trzScopes',
  trzWalletsId = 'custom:trzWalletsId',
  trzCardsId = 'custom:trzCardsId',
  clubs = 'custom:clubs',
  teams = 'custom:teams',
  federations = 'custom:federations',
}

export enum CognitoGroup {
  ClubCoaches = 'club-coaches',
  ClubOwners = 'club-owners',
  FederationOwners = 'federation-owners',
}

enum TrzAttributesDefault {
  trzChildren = 'none',
  trzWalletsId = '0',
  trzCardsId = '0',
}

interface NameValue {
  Name: string;
  Value: string;
}

export interface CognitoUser {
  Enabled: boolean;
  MFAOptions: any[];
  UserAttributes: NameValue[];
  UserStatus:
    | 'UNCONFIRMED'
    | 'CONFIRMED'
    | 'ARCHIVED'
    | 'COMPROMISED'
    | 'UNKNOWN'
    | 'RESET_REQUIRED'
    | 'FORCE_CHANGE_PASSWORD';
}

export interface TrzChild {
  userId: number;
  cards: number[];
  wallets: number[];
}

class CognitoHelper {
  private readonly userPoolId;
  private readonly sub;
  private readonly cognito;

  constructor(cognito: any, userPoolId: string, sub: string) {
    this.sub = sub;
    this.cognito = cognito;
    this.userPoolId = userPoolId;
  }

  addUserToGroup(group: CognitoGroup) {
    const params = {
      GroupName: group,
      UserPoolId: this.userPoolId,
      Username: this.sub,
    };
    return this.cognito.adminAddUserToGroup(params).promise();
  }

  removeUserFromGroup(group: CognitoGroup) {
    const params = {
      GroupName: group,
      UserPoolId: this.userPoolId,
      Username: this.sub,
    };
    return this.cognito.adminRemoveUserFromGroup(params).promise();
  }

  async getUserAttributes() {
    const params = {
      UserPoolId: this.userPoolId,
      Username: this.sub,
    };
    const { UserAttributes }: CognitoUser = await this.cognito.adminGetUser(params).promise();
    return UserAttributes;
  }

  async updateUserAttributes(attributes: NameValue[]) {
    const params = {
      UserAttributes: attributes,
      UserPoolId: this.userPoolId,
      Username: this.sub,
    };

    console.log('Added new attributes:', params);
    return this.cognito.adminUpdateUserAttributes(params).promise();
  }

  async addChildrenData(userId: number, cards?: number[], wallets?: number[]) {
    const attr = await this.getUserAttributes();
    const trzChildrenAttr = attr.find((a) => a.Name === CognitoAttributes.trzChildren);
    let trzChildren: TrzChild[] = [];
    try {
      if (trzChildrenAttr && trzChildrenAttr.Value !== TrzAttributesDefault.trzChildren) {
        trzChildren = JSON.parse(trzChildrenAttr.Value);
      }
    } catch (err) {
      console.error('Error parsing trzChildrenAttr', err, trzChildrenAttr?.Value);
    }

    const newTrzChildrenObj = this.addPropsToObject(trzChildren, userId, cards, wallets);
    const newTrzChildrenObjStr = JSON.stringify(newTrzChildrenObj);
    const newTrzChildrenAttr: NameValue = {
      Name: CognitoAttributes.trzChildren,
      Value: newTrzChildrenObjStr,
    };
    await this.updateUserAttributes([newTrzChildrenAttr]);
  }

  stringToSet(str?: string) {
    const a = str ? String(str).split(', ') : [];
    return new Set(a);
  }

  setToString(set: Set<string>) {
    return [...set.values()].join(', ');
  }

  addClub(clubId: string) {
    return this.addOrRemoveValue(CognitoAttributes.clubs, clubId, false);
  }

  addTeam(teamId: string) {
    return this.addOrRemoveValue(CognitoAttributes.teams, teamId, false);
  }

  addFederation(federationId: string) {
    return this.addOrRemoveValue(CognitoAttributes.federations, federationId, false);
  }

  removeClub(clubId: string) {
    return this.addOrRemoveValue(CognitoAttributes.clubs, clubId, true);
  }

  removeTeam(teamId: string) {
    return this.addOrRemoveValue(CognitoAttributes.teams, teamId, true);
  }

  removeFederation(federationId: string) {
    return this.addOrRemoveValue(CognitoAttributes.federations, federationId, true);
  }

  private async addOrRemoveValue(
    attributeName: CognitoAttributes,
    value: string,
    isRemove: boolean,
  ) {
    const attributes = await this.getUserAttributes();
    const clubsAttr = attributes.find((a) => a.Name === attributeName);
    const values = this.stringToSet(clubsAttr?.Value);

    if (isRemove) {
      values.delete(value);
    } else {
      values.add(value);
    }

    const newValue = this.setToString(values);
    const newAttr: NameValue = {
      Name: attributeName,
      Value: newValue,
    };

    await this.updateUserAttributes([newAttr]);
  }

  private addPropsToObject(
    trzChildren: TrzChild[] = [],
    userId: number,
    cards: number[] = [],
    wallets: number[] = [],
  ) {
    const trzChildrenClone = [...trzChildren];
    const user = trzChildrenClone.find((item) => item.userId === userId);

    if (user) {
      user.cards = [...(user.cards || []), ...(cards || [])];
      user.wallets = [...(user.wallets || []), ...(wallets || [])];
    } else {
      trzChildrenClone.push({
        userId,
        cards: cards || [],
        wallets: wallets || [],
      });
    }

    return trzChildrenClone;
  }
}

export default CognitoHelper;
