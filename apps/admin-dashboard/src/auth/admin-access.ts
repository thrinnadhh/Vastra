export type AdminAssuranceLevel = 'aal1' | 'aal2';
export type AdminAccessDecision = 'AUTHENTICATED' | 'MFA_REQUIRED' | 'ACCESS_DENIED';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveAdminAccess(
  response: unknown,
  expectedUserId: string,
  assuranceLevel: AdminAssuranceLevel,
): AdminAccessDecision {
  if (!isRecord(response) || response['success'] !== true || !isRecord(response['data'])) {
    return 'ACCESS_DENIED';
  }

  const account = response['data'];
  if (
    account['id'] !== expectedUserId ||
    account['accountType'] !== 'ADMIN' ||
    account['status'] !== 'ACTIVE' ||
    !isRecord(account['roleProfile']) ||
    account['roleProfile']['kind'] !== 'ADMIN' ||
    !isRecord(account['scope']) ||
    account['scope']['kind'] !== 'ADMIN'
  ) {
    return 'ACCESS_DENIED';
  }

  return assuranceLevel === 'aal2' ? 'AUTHENTICATED' : 'MFA_REQUIRED';
}
