import { Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { ADMIN_PERMISSIONS, type AdminPermission } from './admin.permissions';

export interface AdminCapabilitiesGateway {
  listGrantedPermissions(client: SupabaseClient): Promise<readonly AdminPermission[]>;
}

export class AdminCapabilitiesGatewayUnavailableError extends Error {}

function parsePermissions(value: unknown): readonly AdminPermission[] {
  if (!Array.isArray(value)) throw new AdminCapabilitiesGatewayUnavailableError();

  const allowed = new Set<string>(ADMIN_PERMISSIONS);
  const permissions = value.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new AdminCapabilitiesGatewayUnavailableError();
    }
    const code = (item as Record<string, unknown>)['code'];
    if (typeof code !== 'string' || !allowed.has(code)) {
      throw new AdminCapabilitiesGatewayUnavailableError();
    }
    return code as AdminPermission;
  });

  return [...new Set(permissions)].sort();
}

@Injectable()
export class SupabaseAdminCapabilitiesGateway implements AdminCapabilitiesGateway {
  public async listGrantedPermissions(client: SupabaseClient): Promise<readonly AdminPermission[]> {
    try {
      const response = await client.from('permissions').select('code').order('code');
      if (response.error !== null) throw new AdminCapabilitiesGatewayUnavailableError();
      return parsePermissions(response.data);
    } catch (error: unknown) {
      if (error instanceof AdminCapabilitiesGatewayUnavailableError) throw error;
      throw new AdminCapabilitiesGatewayUnavailableError();
    }
  }
}
