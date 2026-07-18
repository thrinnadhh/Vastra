import type { AdminPermission, AdminRole } from './admin.permissions';

export const ADMIN_RESOURCE_TYPES = [
  'ORDER',
  'DELIVERY_TASK',
  'MERCHANT',
  'CAPTAIN',
  'CASE',
  'CONFIGURATION',
] as const;

export type AdminResourceType = (typeof ADMIN_RESOURCE_TYPES)[number];

export const ADMIN_MUTATION_REASON_CODES = [
  'CUSTOMER_REQUEST',
  'MERCHANT_REQUEST',
  'CAPTAIN_REQUEST',
  'DELIVERY_FAILURE',
  'PAYMENT_RISK',
  'FRAUD_RISK',
  'POLICY_VIOLATION',
  'SAFETY_INCIDENT',
  'OPERATIONAL_RECOVERY',
  'DATA_CORRECTION',
  'OTHER',
] as const;

export type AdminMutationReasonCode = (typeof ADMIN_MUTATION_REASON_CODES)[number];

export interface AdminActorSnapshot {
  readonly actorId: string;
  readonly role: AdminRole;
  readonly permissions: readonly AdminPermission[];
  readonly assuranceLevel: 'aal1' | 'aal2';
}

export interface AdminMutationContext {
  readonly requestId: string | null;
  readonly idempotencyKey: string;
  readonly reasonCode: AdminMutationReasonCode;
  readonly note: string | null;
}

export interface AdminAuditChange {
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
}

export interface AdminAuditEntry {
  readonly id: string;
  readonly actorId: string;
  readonly action: string;
  readonly resourceType: AdminResourceType;
  readonly resourceId: string;
  readonly reasonCode: AdminMutationReasonCode;
  readonly note: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
  readonly change: AdminAuditChange;
  readonly createdAt: string;
}
