import { SetMetadata } from '@nestjs/common';

export const ALLOW_ADMIN_AAL1_METADATA = Symbol('vastra.allow-admin-aal1');

export function AllowAdminAal1(): MethodDecorator & ClassDecorator {
  return SetMetadata(ALLOW_ADMIN_AAL1_METADATA, true);
}
