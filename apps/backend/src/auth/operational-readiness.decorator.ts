import { SetMetadata } from '@nestjs/common';

export const OPERATIONAL_READINESS_METADATA = Symbol('vastra.operational-readiness');

export function RequireOperationalReadiness(): MethodDecorator & ClassDecorator {
  return SetMetadata(OPERATIONAL_READINESS_METADATA, true);
}
