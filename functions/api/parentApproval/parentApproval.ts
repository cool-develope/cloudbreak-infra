import DynamoHelper from './dynamoHelper';
import {
  ParentApprovalStatus,
  ParentApprovalType,
  ApproveAsParentInput,
  ApproveAsParentPayload,
} from './types';

export default class ParentApproval {
  private readonly dynamoHelper: DynamoHelper;
  constructor(
    private db: any,
    private tableName: string,
    private imagesDomain: string,
    private eventbridge: any,
  ) {
    this.dynamoHelper = new DynamoHelper(this.db, this.tableName);
  }

  private putEvents(type: string, detail: any): Promise<any> {
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

  async approve(
    parentUserId: string,
    { childUserId, type, id }: ApproveAsParentInput,
  ): Promise<ApproveAsParentPayload> {
    const errors: string[] = [];

    // TODO: check child-parent relation
    const pk = `user#${childUserId}`;
    const sk = `parent-approval#${type.toLowerCase()}#${id}`;
    const data = {
      approved: true,
      modifiedAt: new Date().toISOString(),
    };
    this.dynamoHelper.updateItem(pk, sk, data);

    await this.putEvents(`ApprovedParentApprovalFor${type}`, {
      parentUserId,
      childUserId,
      id,
    });

    return {
      errors,
    };
  }

  async reject(
    parentUserId: string,
    { childUserId, type, id }: ApproveAsParentInput,
  ): Promise<ApproveAsParentPayload> {
    const errors: string[] = [];

    // TODO: check child-parent relation
    const pk = `user#${childUserId}`;
    const sk = `parent-approval#${type.toLowerCase()}#${id}`;
    const data = {
      approved: false,
      modifiedAt: new Date().toISOString(),
    };
    this.dynamoHelper.updateItem(pk, sk, data);

    await this.putEvents(`RejectedParentApprovalFor${type}`, {
      parentUserId,
      childUserId,
      id,
    });

    return {
      errors,
    };
  }

  async get(
    childUserId: string,
    type: ParentApprovalType,
    id: string,
  ): Promise<ParentApprovalStatus | null> {
    const pk = `user#${childUserId}`;
    const sk = `parent-approval#${type.toLowerCase()}#${id}`;
    const { Item: parentApproval } = await this.dynamoHelper.getItem(pk, sk);

    if (parentApproval) {
      if (parentApproval.approved === true) {
        return ParentApprovalStatus.Approved;
      } else if (parentApproval.approved === false) {
        return ParentApprovalStatus.Rejected;
      }

      return ParentApprovalStatus.Pending;
    }

    return null;
  }
}
