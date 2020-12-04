export enum FieldName {
  approveAsParent = 'approveAsParent',
  rejectAsParent = 'rejectAsParent',
  checkParentApproval = 'checkParentApproval',
}

export enum ParentApprovalType {
  Event = 'Event',
}

export enum ParentApprovalStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export interface FunctionEvent {
  arguments: {
    input: ApproveAsParentInput;
    childUserId: string;
    type: ParentApprovalType;
    id: string;
  };
  identity: { sub: string };
  info: { fieldName: FieldName };
}

export interface ApproveAsParentInput {
  childUserId: string;
  type: ParentApprovalType;
  id: string;
}

export interface ApproveAsParentPayload {
  errors: string[];
}
