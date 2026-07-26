import type { AuthenticatorAssuranceLevel } from '../auth/auth.types';
import type { AdminPermission } from './admin.permissions';

export interface AdminCapabilities {
  readonly assuranceLevel: AuthenticatorAssuranceLevel;
  readonly permissions: readonly AdminPermission[];
  readonly mfaRequiredForSensitiveOperations: true;
}

export interface GetAdminCapabilitiesResponse {
  readonly success: true;
  readonly data: AdminCapabilities;
  readonly meta: {
    readonly requestId: null;
  };
}
