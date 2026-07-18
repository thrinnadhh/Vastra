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

  it('gives trust and safety actor controls without configuration mutation access', () => {
    const permissions = permissionsForAdminRole('TRUST_AND_SAFETY');
    expect(permissions).toContain('admin.merchants.manage');
    expect(permissions).toContain('admin.captains.manage');
    expect(permissions).not.toContain('admin.configuration.manage');
  });
});
