import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminConfigurationGateway } from './admin-configuration.gateway';
import {
  AdminConfigurationRequestInvalidError,
  AdminConfigurationService,
} from './admin-configuration.service';
import type { AdminUpdateSettingInput } from './admin-configuration.types';

const CONTEXT = {
  actor: { id: '10000000-0000-4000-8000-000000000001' },
} as AuthenticatedRequestContext;
const KEY = '20000000-0000-4000-8000-000000000001';

class GatewayStub implements AdminConfigurationGateway {
  public input: AdminUpdateSettingInput | null = null;
  public list() {
    return Promise.resolve([]);
  }
  public update(input: AdminUpdateSettingInput) {
    this.input = input;
    return Promise.resolve({
      id: '30000000-0000-4000-8000-000000000001',
      key: input.key,
      value: input.value,
      valueType: 'NUMBER' as const,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      version: 2,
      updatedBy: input.actorId,
      updatedAt: '2026-07-18T00:00:00.000Z',
    });
  }
}

describe('AdminConfigurationService', () => {
  it('builds a version-checked configuration command', async () => {
    const gateway = new GatewayStub();
    const service = new AdminConfigurationService(gateway);
    await service.update(CONTEXT, 'dispatch.offer_ttl_seconds', KEY, null, {
      value: 45,
      expectedVersion: 1,
      reasonCode: 'OPERATIONAL_RECOVERY',
    });
    expect(gateway.input).toEqual(expect.objectContaining({ expectedVersion: 1, value: 45 }));
  });

  it('rejects arbitrary setting keys', () => {
    const service = new AdminConfigurationService(new GatewayStub());
    expect(() =>
      service.update(CONTEXT, 'database.password', KEY, null, {
        value: 'x',
        reasonCode: 'OTHER',
      }),
    ).toThrow(AdminConfigurationRequestInvalidError);
  });
});
