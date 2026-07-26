import { describe, expect, it } from 'vitest';

import { resolveAdminAccess } from './admin-access';

const adminAccount = {
  success: true,
  data: {
    id: '6cf56a4d-d209-45f3-9b21-e198eba84c09',
    email: 'operations@example.test',
    accountType: 'ADMIN',
    status: 'ACTIVE',
    profile: {
      id: '6cf56a4d-d209-45f3-9b21-e198eba84c09',
      accountType: 'ADMIN',
      status: 'ACTIVE',
      fullName: 'Operations Admin',
      phoneNumber: null,
      avatarUrl: null,
    },
    roleProfile: {
      kind: 'ADMIN',
      adminRole: 'OPERATIONS_ADMIN',
      department: 'Operations',
      cityScope: ['Tirupati'],
    },
    scope: {
      kind: 'ADMIN',
      department: 'Operations',
      cityScope: ['Tirupati'],
    },
  },
  meta: { requestId: null },
} as const;

describe('resolveAdminAccess', () => {
  it('allows only the matching active admin with an AAL2 session', () => {
    expect(resolveAdminAccess(adminAccount, adminAccount.data.id, 'aal2')).toBe('AUTHENTICATED');
  });

  it('requires MFA when the matching administrator is still AAL1', () => {
    expect(resolveAdminAccess(adminAccount, adminAccount.data.id, 'aal1')).toBe('MFA_REQUIRED');
  });

  it('denies wrong-role, malformed, and mismatched identities without leaking details', () => {
    expect(
      resolveAdminAccess(
        {
          ...adminAccount,
          data: { ...adminAccount.data, accountType: 'CUSTOMER' },
        },
        adminAccount.data.id,
        'aal2',
      ),
    ).toBe('ACCESS_DENIED');
    expect(resolveAdminAccess(adminAccount, 'a9fd1135-7715-4879-95ee-93c1bdb80724', 'aal2')).toBe(
      'ACCESS_DENIED',
    );
    expect(resolveAdminAccess({ success: true }, adminAccount.data.id, 'aal2')).toBe(
      'ACCESS_DENIED',
    );
  });
});
