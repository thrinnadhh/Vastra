import type { AdminMutationReasonCode } from './admin.types';

export const ADMIN_CASE_CATEGORIES = [
  'ORDER_ISSUE',
  'DELIVERY_INCIDENT',
  'MERCHANT_CONDUCT',
  'CAPTAIN_CONDUCT',
  'SAFETY',
  'FRAUD',
  'OTHER',
] as const;

export const ADMIN_CASE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const ADMIN_CASE_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_USER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
] as const;

export type AdminCaseCategory = (typeof ADMIN_CASE_CATEGORIES)[number];
export type AdminCasePriority = (typeof ADMIN_CASE_PRIORITIES)[number];
export type AdminCaseStatus = (typeof ADMIN_CASE_STATUSES)[number];
export type AdminCaseSnapshot = Readonly<Record<string, unknown>>;

export interface AdminCaseListInput {
  readonly status: AdminCaseStatus | null;
  readonly priority: AdminCasePriority | null;
  readonly assignedTo: string | null;
  readonly limit: number;
}

export interface AdminCaseMutationContext {
  readonly actorId: string;
  readonly caseId: string;
  readonly reasonCode: AdminMutationReasonCode;
  readonly note: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
}

export interface AdminCreateCaseInput {
  readonly actorId: string;
  readonly category: AdminCaseCategory;
  readonly priority: AdminCasePriority;
  readonly subject: string;
  readonly description: string;
  readonly orderId: string | null;
  readonly shopId: string | null;
  readonly deliveryTaskId: string | null;
  readonly returnRequestId: string | null;
  readonly merchantId: string | null;
  readonly captainId: string | null;
  readonly reasonCode: AdminMutationReasonCode;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
}

export interface AdminAssignCaseInput extends AdminCaseMutationContext {
  readonly assignedTo: string;
  readonly assignedTeam: string | null;
}

export interface AdminAddCaseNoteInput extends AdminCaseMutationContext {
  readonly message: string;
  readonly attachmentObjectKey: string | null;
}

export interface AdminResolveCaseInput extends AdminCaseMutationContext {
  readonly resolutionCode: string;
  readonly resolutionNote: string;
}
