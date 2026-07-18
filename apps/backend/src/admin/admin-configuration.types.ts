import type { AdminMutationReasonCode } from './admin.types';

export const ADMIN_OPERATIONAL_SETTING_KEYS = [
  'dispatch.offer_ttl_seconds',
  'dispatch.initial_radius_meters',
  'dispatch.radius_step_meters',
  'dispatch.max_radius_meters',
  'dispatch.max_offer_waves',
  'operations.order_intervention_minutes',
  'feature.admin_case_escalation',
] as const;

export type AdminOperationalSettingKey = (typeof ADMIN_OPERATIONAL_SETTING_KEYS)[number];
export type AdminSettingScopeType = 'GLOBAL' | 'CITY' | 'SHOP';

export interface AdminOperationalSetting {
  readonly id: string;
  readonly key: AdminOperationalSettingKey;
  readonly value: unknown;
  readonly valueType: 'BOOLEAN' | 'NUMBER' | 'STRING' | 'JSON';
  readonly scopeType: AdminSettingScopeType;
  readonly scopeId: string | null;
  readonly version: number;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface AdminUpdateSettingInput {
  readonly actorId: string;
  readonly key: AdminOperationalSettingKey;
  readonly value: unknown;
  readonly scopeType: AdminSettingScopeType;
  readonly scopeId: string | null;
  readonly expectedVersion: number | null;
  readonly reasonCode: AdminMutationReasonCode;
  readonly note: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
}
