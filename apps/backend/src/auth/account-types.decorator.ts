import { SetMetadata } from '@nestjs/common';

import type { AccountType } from './auth.types';

export const ALLOWED_ACCOUNT_TYPES_METADATA = Symbol('vastra.allowed-account-types');

export function AllowAccountTypes(
  ...accountTypes: readonly AccountType[]
): MethodDecorator & ClassDecorator {
  if (accountTypes.length === 0) {
    throw new TypeError('AllowAccountTypes requires at least one account type.');
  }

  return SetMetadata(ALLOWED_ACCOUNT_TYPES_METADATA, Object.freeze([...new Set(accountTypes)]));
}
