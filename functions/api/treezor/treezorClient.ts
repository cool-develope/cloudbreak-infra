// @ts-ignore
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import DynamoHelper from './dynamoHelper';

enum TransactionType {
  Payin = 'Payin',
  Payout = 'Payout',
  Transfer = 'Transfer',
}

enum TransactionStatus {
  PENDING = 'PENDING',
  CANCELED = 'CANCELED',
  VALIDATED = 'VALIDATED',
}

interface Image {
  url: string;
}

interface UserPublic {
  id: string;
  firstName: string;
  lastName: string;
  photo: Image | null;
}

interface TreezorTransactionResponse {
  transactions: TreezorTransaction[];
}

interface TreezorTransferResponse {
  transfers: TreezorTransfer[];
}

interface TreezorPayinResponse {
  payins: TreezorPayin[];
}

interface TreezorPayoutResponse {
  payouts: TreezorPayout[];
}

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  transferTypeId: number | null;
  paymentMethodId: number | null;
  createdDate: string;
  balance: number;
  isIncome: boolean;
  notes: string;
  status: string | null;
  event: TransactionForEvent | null;
  fromUser: UserPublic | null;
  toUser: UserPublic | null;
  walletDebitId: number | null;
  walletCreditId: number | null;
  payoutTypeId: number | null;
  bankaccountIBAN: string | null;
}

interface TreezorTransaction {
  transactionId: number;
  walletDebitId: number;
  walletCreditId: number;
  transactionType: TransactionType;
  foreignId: number;
  name: string;
  description: string;
  valueDate: string;
  executionDate: string;
  amount: string;
  walletDebitBalance: string;
  walletCreditBalance: string;
  currency: string;
  createdDate: string;
}

interface TreezorTransfer {
  transferId: number;
  transferStatus: string;
  transferTag: string;
  walletId: number;
  walletTypeId: number;
  beneficiaryWalletId: number;
  beneficiaryWalletTypeId: number;
  transferDate: string;
  walletEventName: string;
  walletAlias: string;
  beneficiaryWalletEventName: string;
  beneficiaryWalletAlias: string;
  amount: string;
  currency: string;
  label: string;
  transferTypeId: number;
  createdDate: string;
  modifiedDate: number;
}

interface TreezorPayin {
  payinId: number;
  payinTag: string;
  payinStatus: string;
  codeStatus: number;
  informationStatus: string;
  walletId: number;
  userId: number;
  cartId: number;
  walletEventName: string;
  walletAlias: string;
  userFirstname: string;
  userLastname: string;
  messageToUser: string;
  paymentMethodId: number;
  amount: string;
  currency: string;
}

interface TreezorPayout {
  payoutId: number;
  payoutTag: string;
  payoutStatus: string;
  payoutTypeId: number;
  payoutType: string;
  walletId: number;
  payoutDate: string;
  walletEventName: string;
  walletAlias: string;
  userFirstname: string;
  userLastname: string;
  userId: number;
  bankaccountId: number;
  beneficiaryId: number;
  uniqueMandateReference: string;
  bankaccountIBAN: string;
  label: string;
  amount: string;
  currency: string;
  partnerFee: string;
  createdDate: string;
  modifiedDate: string;
}

interface TransactionForEvent {
  id: string;
  title: string;
  organization?: EventOrganization;
}

enum OrganizationType {
  Federation = 'Federation',
  Club = 'Club',
}

interface EventOrganization {
  id: string;
  name: string;
  type: OrganizationType;
  logo: Image;
  walletId?: number;
}

class TreezorClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly dynamoHelper: DynamoHelper;
  private readonly imagesDomain: string;

  constructor(
    baseUrl: string,
    clientId: string,
    clientSecret: string,
    dynamoHelper: DynamoHelper,
    imagesDomain: string,
  ) {
    this.baseUrl = baseUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.dynamoHelper = dynamoHelper;
    this.imagesDomain = imagesDomain;
  }

  private objToURLSearchParams(obj: any = {}) {
    const params = new URLSearchParams();
    for (const key in obj) {
      params.append(key, String(obj[key]));
    }
    return params;
  }

  private async getUser(userId: string) {
    const pk = `user#${userId}`;
    const sk = 'metadata';
    const { Item } = await this.dynamoHelper.getItem(pk, sk);
    if (Item && Item.pk) {
      Item.id = Item.pk.replace('user#', '');
      return Item;
    }

    return null;
  }

  private getTypeUser({ pk, firstName, lastName, photo }: any): UserPublic {
    return {
      id: pk.replace('user#', ''),
      firstName,
      lastName,
      photo: this.getTypeImage(photo),
    };
  }

  private getTypeImage(photo: string = '') {
    return {
      url: photo ? `https://${this.imagesDomain}/${photo}` : '',
    };
  }

  getEvenId(transferTag: string): string | null {
    return transferTag && transferTag.startsWith('event:')
      ? transferTag.replace('event:', '')
      : null;
  }

  getFromAndToUsers(transferTag: string): { fromUserId: string | null; toUserId: string | null } {
    let fromUserId = null,
      toUserId = null;

    if (
      transferTag &&
      transferTag.length &&
      transferTag.includes('from:') &&
      transferTag.includes('to:') &&
      transferTag.includes(',')
    ) {
      [fromUserId, toUserId] = transferTag.replace('from:', '').replace('to:', '').split(',');
    }

    return { fromUserId, toUserId };
  }

  scanItems(pk: string, sk: string, fieldName: string, fieldValue: any) {
    const params = {
      TableName: this.dynamoHelper.tableName,
      FilterExpression: `begins_with(pk, :pk) and sk = :sk and ${fieldName} = :fieldValue`,
      ExpressionAttributeValues: {
        ':pk': pk,
        ':sk': sk,
        ':fieldValue': fieldValue,
      },
    };

    return this.dynamoHelper.db.scan(params).promise();
  }

  async getUserByWalletId(walletId: number): Promise<UserPublic | null> {
    const { Items } = await this.scanItems(
      'user#',
      'metadata',
      'treezorWalletId',
      Number(walletId),
    );

    if (Items && Items.length) {
      return this.getTypeUser(Items[0]);
    }

    return null;
  }

  async getFromAndToUsersData(
    walletId: number,
    transferTag: string,
    t: TreezorTransaction,
  ): Promise<{ fromUser: UserPublic | null; toUser: UserPublic | null }> {
    // const isIncome = t.walletCreditId === walletId;
    const { walletCreditId, walletDebitId } = t;
    let fromUser: UserPublic | null = null;
    let toUser: UserPublic | null = null;

    if (walletCreditId && walletDebitId) {
      [toUser, fromUser] = await Promise.all([
        this.getUserByWalletId(walletCreditId),
        this.getUserByWalletId(walletDebitId),
      ]);
    }

    // const { fromUserId, toUserId } = this.getFromAndToUsers(transferTag);
    // if (fromUserId && toUserId) {
    //   const [fromUserData, toUserData] = await Promise.all([
    //     this.getUser(fromUserId),
    //     this.getUser(toUserId),
    //   ]);

    //   fromUser = this.getTypeUser(fromUserData);
    //   toUser = this.getTypeUser(toUserData);
    // }

    return {
      toUser,
      fromUser,
    };
  }

  async getTransfer(transferId: number, treezorToken: string): Promise<TreezorTransfer | null> {
    const params = this.objToURLSearchParams({ transferId });
    const headers = { Authorization: `Bearer ${treezorToken}` };
    const transfersUrl = `${this.baseUrl}/v1/transfers?${params.toString()}`;

    const response = await fetch(transfersUrl, { headers });
    const json: TreezorTransferResponse = await response.json();

    if (json && json.transfers && json.transfers.length > 0) {
      return json.transfers[0];
    }

    return null;
  }

  async fetchData(headers: any, url: string, propertyName: string): Promise<any[]> {
    try {
      const response = await fetch(url, { headers });
      const json = await response.json();
      const result = json ? json[propertyName] || [] : [];
      return result;
    } catch (err) {
      console.error({
        url,
        err,
      });
    }

    return [];
  }

  async getEvent(eventId: string | null): Promise<TransactionForEvent | null> {
    let event: TransactionForEvent | null = null;
    if (eventId) {
      const { Item: eventData } = await this.dynamoHelper.getItem(`event#${eventId}`, 'metadata');
      if (eventData) {
        const { clubId, federationId, title } = eventData;
        event = { id: eventId, title };

        if (clubId) {
          const { Item: clubData } = await this.dynamoHelper.getItem(`club#${clubId}`, 'metadata');
          event.organization = {
            id: clubId,
            name: clubData.name,
            logo: this.getTypeImage(clubData.logo),
            type: OrganizationType.Club,
          };
        } else if (federationId) {
          const { Item: federationData } = await this.dynamoHelper.getItem(
            `federation#${federationId}`,
            'metadata',
          );

          event.organization = {
            id: federationId,
            name: federationData.name,
            logo: this.getTypeImage(federationData.logo),
            type: OrganizationType.Federation,
          };
        }
      }
    }

    return event;
  }

  async getTransactions(walletId: number, treezorToken: string): Promise<Transaction[]> {
    const params = this.objToURLSearchParams({ walletId });
    const headers = { Authorization: `Bearer ${treezorToken}` };
    const transactionsUrl = `${this.baseUrl}/v1/transactions?${params.toString()}`;
    const payoutsUrl = `${this.baseUrl}/v1/payouts?${params.toString()}`;
    const payinsUrl = `${this.baseUrl}/v1/payins?${params.toString()}`;

    try {
      const [transactions, payins, payouts]: [
        transactions: TreezorTransaction[],
        payins: TreezorPayin[],
        payouts: TreezorPayout[],
      ] = await Promise.all([
        this.fetchData(headers, transactionsUrl, 'transactions'),
        this.fetchData(headers, payinsUrl, 'payins'),
        this.fetchData(headers, payoutsUrl, 'payouts'),
      ]);

      // console.debug({
      //   walletId,
      //   transactions,
      //   payins,
      //   payouts,
      // });

      const result: Transaction[] = [];

      for (const t of transactions) {
        const transfer =
          t.transactionType === TransactionType.Transfer
            ? await this.getTransfer(t.foreignId, treezorToken)
            : null;

        const payin =
          t.transactionType === TransactionType.Payin
            ? payins.find(({ payinId }) => payinId === t.foreignId)
            : null;

        const payout =
          t.transactionType === TransactionType.Payout
            ? payouts.find(({ payoutId }) => payoutId === t.foreignId)
            : null;

        // console.log({
        //   t,
        //   transfer,
        //   payin,
        // });

        const transferTypeId = transfer?.transferTypeId || null;
        const paymentMethodId = payin?.paymentMethodId || null;
        const notes = transfer?.label || payout?.label || '';
        const status =
          transfer?.transferStatus || payin?.payinStatus || payout?.payoutStatus || null;
        const transferTag = transfer?.transferTag || '';
        const eventId = this.getEvenId(transferTag);
        const event = await this.getEvent(eventId);
        const isIncome = t.walletCreditId === walletId;
        const balance =
          t.walletCreditId === walletId
            ? Number(t.walletCreditBalance)
            : Number(t.walletDebitBalance);

        const { fromUser, toUser } = await this.getFromAndToUsersData(walletId, transferTag, t);

        const transaction: Transaction = {
          id: String(t.transactionId),
          type: t.transactionType,
          amount: Number(t.amount),
          currency: t.currency,
          transferTypeId,
          paymentMethodId,
          createdDate: new Date(t.createdDate).toISOString(),
          balance,
          notes,
          status,
          event,
          isIncome,
          fromUser,
          toUser,
          walletDebitId: t.walletDebitId,
          walletCreditId: t.walletCreditId,
          payoutTypeId: payout?.payoutTypeId || null,
          bankaccountIBAN: payout?.bankaccountIBAN || '',
        };

        result.push(transaction);
      }

      for (const payout of payouts) {
        const transaction: Transaction = {
          id: String(payout.payoutId),
          type: TransactionType.Payout,
          amount: Number(payout.amount),
          currency: payout.currency,
          transferTypeId: null,
          paymentMethodId: null,
          createdDate: new Date(payout.createdDate).toISOString(),
          balance: 0,
          notes: payout.label,
          status: payout.payoutStatus,
          event: null,
          isIncome: false,
          fromUser: null,
          toUser: null,
          walletDebitId: 0,
          walletCreditId: 0,
          payoutTypeId: payout.payoutTypeId,
          bankaccountIBAN: payout.bankaccountIBAN,
        };

        result.push(transaction);
      }

      // @ts-ignore
      result.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

      return result;
    } catch (err) {
      console.error(err);
    }

    return [];
  }

  private async getTreezorToken(): Promise<string | null> {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('scope', 'read_write admin');

    try {
      const res = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        body: params,
      });

      const { access_token } = await res.json();
      return access_token;
    } catch (err) {
      console.error('ERROR getTreezorToken', {
        params,
        err,
      });
      return null;
    }
  }
}

export default TreezorClient;
