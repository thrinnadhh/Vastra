import { describe, expect, it } from 'vitest';

import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLE_PERMISSIONS,
  adminRoleHasPermission,
  permissionsForAdminRole,
} from './admin.permissions';

describe('admin permission contracts', () => {
  it('keeps super admin synchronized with the canonical permission catalogue', () => {
    expect(ADMIN_ROLE_PERMISSIONS.SUPER_ADMIN).toEqual(ADMIN_PERMISSIONS);
  });

  it('keeps read-only operators away from mutation permissions', () => {
    expect(adminRoleHasPermission('OPERATIONS_VIEWER', 'admin.orders.read')).toBe(true);
    expect(adminRoleHasPermission('OPERATIONS_VIEWER', 'admin.orders.manage')).toBe(false);
    expect(adminRoleHasPermission('OPERATIONS_VIEWER', 'admin.configuration.manage')).toBe(false);
  });

  it('gives trust and safety actor controls without finance access', () => {
    const permissions = permissionsForAdminRole('TRUST_AND_SAFETY');
    expect(permissions).toContain('admin.merchants.manage');
    expect(permissions).toContain('admin.captains.manage');
    expect(permissions).not.toContain('admin.configuration.manage');
    expect(permissions).not.toContain('admin.refunds.read');
  });

  it('keeps finance analysts read-only across every financial domain', () => {
    const permissions = permissionsForAdminRole('FINANCE_ANALYST');
    expect(permissions).toContain('admin.payments.read');
    expect(permissions).toContain('admin.returns.read');
    expect(permissions).toContain('admin.refunds.read');
    expect(permissions).toContain('admin.settlements.read');
    expect(permissions).toContain('admin.payouts.read');
    expect(permissions).toContain('admin.cod.read');
    expect(permissions.some((permission) => permission.endsWith('.manage'))).toBe(false);
  });

  it('gives finance managers paired read and manage permissions', () => {
    const permissions = permissionsForAdminRole('FINANCE_MANAGER');
    for (const permission of permissions.filter((value) => value.endsWith('.manage'))) {
      const readPermission = permission.replace(/\.manage$/u, '.read');
      expect(permissions).toContain(readPermission);
    }
  });
});
