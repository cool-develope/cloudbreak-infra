enum TrzAttributes {
  trzChildren = 'custom:trzChildren',
  trzUserId = 'custom:trzUserId',
  trzScopes = 'custom:trzScopes',
  trzWalletsId = 'custom:trzWalletsId',
  trzCardsId = 'custom:trzCardsId',
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

    return this.cognito.adminUpdateUserAttributes(params).promise();
  }

  async addChildrenData(userId: number, cards?: number[], wallets?: number[]) {
    const attr = await this.getUserAttributes();
    const trzChildrenAttr = attr.find((a) => a.Name === TrzAttributes.trzChildren);
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
      Name: TrzAttributes.trzChildren,
      Value: newTrzChildrenObjStr,
    };
    await this.updateUserAttributes([newTrzChildrenAttr]);
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
