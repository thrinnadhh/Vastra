import 'reflect-metadata';

import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { ALLOWED_ACCOUNT_TYPES_METADATA } from '../auth/account-types.decorator';
import { ALLOW_ADMIN_AAL1_METADATA } from '../auth/admin-mfa.decorator';
import { OPERATIONAL_READINESS_METADATA } from '../auth/operational-readiness.decorator';
import { REQUIRED_PERMISSIONS_METADATA } from '../auth/permissions.decorator';
import { AdminCapabilitiesController } from './admin-capabilities.controller';
import { AdminAuditController } from './admin-audit.controller';
import { AdminCityController } from './admin-city.controller';
import { AdminCaptainController } from './admin-captain.controller';
import { AdminCaseController } from './admin-case.controller';
import { AdminConfigurationController } from './admin-configuration.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminMerchantController } from './admin-merchant.controller';
import { AdminOrderListController } from './admin-order-list.controller';
import { AdminOrderInvestigationController } from './admin-order-investigation.controller';
import { AdminOrderOperationsController } from './admin-order-operations.controller';
import { AdminModule } from './admin.module';
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  ADMIN_ROLE_PERMISSIONS,
  type AdminPermission,
} from './admin.permissions';

const ADMIN_CONTROLLERS = [
  AdminCapabilitiesController,
  AdminAuditController,
  AdminDashboardController,
  AdminOrderListController,
  AdminOrderInvestigationController,
  AdminOrderOperationsController,
  AdminMerchantController,
  AdminCaptainController,
  AdminCityController,
  AdminConfigurationController,
  AdminCaseController,
] as const;

const OPERATIONAL_ADMIN_CONTROLLERS = ADMIN_CONTROLLERS.filter(
  (controller) => controller !== AdminCapabilitiesController,
);

const GET_REQUEST_METHOD: number = RequestMethod.GET;

function readMetadata(key: string | symbol, target: object): unknown {
  return Reflect.getMetadata(key, target) as unknown;
}

function requireArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Expected metadata array');
  return value;
}

function requirePermissions(value: unknown): readonly string[] {
  return requireArray(value).map((permission) => {
    if (typeof permission !== 'string') throw new TypeError('Expected permission string');
    return permission;
  });
}

describe('Sprint 9 admin module contracts', () => {
  it('registers every Sprint 9 controller exactly once', () => {
    const registered = requireArray(readMetadata(MODULE_METADATA.CONTROLLERS, AdminModule));
    expect(registered).toStrictEqual(ADMIN_CONTROLLERS);
    expect(new Set(registered).size).toBe(ADMIN_CONTROLLERS.length);
  });

  it('keeps every admin route account-gated', () => {
    for (const controller of ADMIN_CONTROLLERS) {
      expect(readMetadata(ALLOWED_ACCOUNT_TYPES_METADATA, controller)).toStrictEqual(['ADMIN']);
    }
  });

  it('keeps the capability bootstrap available before AAL2 readiness', () => {
    expect(
      readMetadata(OPERATIONAL_READINESS_METADATA, AdminCapabilitiesController),
    ).toBeUndefined();
    const handler: unknown = Object.getOwnPropertyDescriptor(
      AdminCapabilitiesController.prototype,
      'get',
    )?.value;
    if (typeof handler !== 'function') {
      throw new TypeError('AdminCapabilitiesController.get must be a method');
    }
    expect(readMetadata(ALLOW_ADMIN_AAL1_METADATA, handler)).toBe(true);
    expect(readMetadata(REQUIRED_PERMISSIONS_METADATA, handler)).toBeUndefined();
  });

  it('keeps every operational admin route readiness- and permission-gated', () => {
    for (const controller of OPERATIONAL_ADMIN_CONTROLLERS) {
      expect(readMetadata(OPERATIONAL_READINESS_METADATA, controller)).toBe(true);

      const prototype: object = controller.prototype;
      for (const methodName of Object.getOwnPropertyNames(prototype)) {
        if (methodName === 'constructor') continue;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
        const rawHandler: unknown = descriptor?.value;
        if (typeof rawHandler !== 'function') continue;

        const requestMethod = readMetadata(METHOD_METADATA, rawHandler);
        if (typeof requestMethod !== 'number') continue;

        const permissions = requirePermissions(
          readMetadata(REQUIRED_PERMISSIONS_METADATA, rawHandler),
        );
        expect(permissions.length).toBeGreaterThan(0);

        for (const permission of permissions) {
          expect(ADMIN_PERMISSIONS).toContain(permission);
          const matchesRequestMethod =
            requestMethod === GET_REQUEST_METHOD
              ? permission.endsWith('.read') || permission === 'operations.read'
              : permission.endsWith('.manage') || permission === 'operations.manage';
          expect(matchesRequestMethod).toBe(true);
        }
      }
    }
  });

  it('keeps every role permission unique and inside the canonical catalogue', () => {
    for (const role of ADMIN_ROLES) {
      const permissions = ADMIN_ROLE_PERMISSIONS[role];
      expect(new Set(permissions).size).toBe(permissions.length);
      for (const permission of permissions) expect(ADMIN_PERMISSIONS).toContain(permission);
    }
  });

  it('never grants a manage permission without its corresponding read permission', () => {
    for (const role of ADMIN_ROLES) {
      const permissions = ADMIN_ROLE_PERMISSIONS[role];
      for (const permission of permissions) {
        if (!permission.endsWith('.manage')) continue;
        const readPermission = permission.replace(/\.manage$/u, '.read') as AdminPermission;
        expect(permissions).toContain(readPermission);
      }
    }
  });

  it('reserves configuration mutation for super administrators', () => {
    for (const role of ADMIN_ROLES) {
      expect(ADMIN_ROLE_PERMISSIONS[role].includes('admin.configuration.manage')).toBe(
        role === 'SUPER_ADMIN',
      );
    }
  });
});
