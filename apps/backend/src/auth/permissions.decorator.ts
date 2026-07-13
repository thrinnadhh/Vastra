import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_METADATA = Symbol('vastra.required-permissions');

const PERMISSION_CODE_PATTERN = /^[a-z][a-z0-9_.-]*$/u;

export function RequirePermissions(
  ...permissionCodes: readonly string[]
): MethodDecorator & ClassDecorator {
  if (permissionCodes.length === 0) {
    throw new TypeError('RequirePermissions requires at least one permission code.');
  }

  const normalized = permissionCodes.map((permissionCode) => {
    const trimmed = permissionCode.trim();

    if (!PERMISSION_CODE_PATTERN.test(trimmed)) {
      throw new TypeError(`Invalid Vastra permission code: ${permissionCode}`);
    }

    return trimmed;
  });

  return SetMetadata(REQUIRED_PERMISSIONS_METADATA, Object.freeze([...new Set(normalized)]));
}
