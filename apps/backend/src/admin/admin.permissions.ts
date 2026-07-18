export const ADMIN_PERMISSIONS = [
  'operations.read',
  'operations.manage',
  'admin.dashboard.read',
  'admin.orders.read',
  'admin.orders.manage',
  'admin.merchants.read',
  'admin.merchants.manage',
  'admin.captains.read',
  'admin.captains.manage',
  'admin.cases.read',
  'admin.cases.manage',
  'admin.configuration.read',
  'admin.configuration.manage',
  'admin.audit.read',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_ROLES = [
  'OPERATIONS_VIEWER',
  'OPERATIONS_AGENT',
  'OPERATIONS_MANAGER',
  'TRUST_AND_SAFETY',
  'SUPER_ADMIN',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly AdminPermission[]>> = {
  OPERATIONS_VIEWER: [
    'operations.read',
    'admin.dashboard.read',
    'admin.orders.read',
    'admin.merchants.read',
    'admin.captains.read',
    'admin.cases.read',
  ],
  OPERATIONS_AGENT: [
    'operations.read',
    'operations.manage',
    'admin.dashboard.read',
    'admin.orders.read',
    'admin.orders.manage',
    'admin.merchants.read',
    'admin.captains.read',
    'admin.cases.read',
    'admin.cases.manage',
  ],
  OPERATIONS_MANAGER: [
    'operations.read',
    'operations.manage',
    'admin.dashboard.read',
    'admin.orders.read',
    'admin.orders.manage',
    'admin.merchants.read',
    'admin.merchants.manage',
    'admin.captains.read',
    'admin.captains.manage',
    'admin.cases.read',
    'admin.cases.manage',
    'admin.configuration.read',
    'admin.audit.read',
  ],
  TRUST_AND_SAFETY: [
    'operations.read',
    'admin.dashboard.read',
    'admin.orders.read',
    'admin.merchants.read',
    'admin.merchants.manage',
    'admin.captains.read',
    'admin.captains.manage',
    'admin.cases.read',
    'admin.cases.manage',
    'admin.audit.read',
  ],
  SUPER_ADMIN: ADMIN_PERMISSIONS,
};

export function permissionsForAdminRole(role: AdminRole): readonly AdminPermission[] {
  return ADMIN_ROLE_PERMISSIONS[role];
}

export function adminRoleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_ROLE_PERMISSIONS[role].includes(permission);
}
