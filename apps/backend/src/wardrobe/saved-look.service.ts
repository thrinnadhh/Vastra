import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { rethrowWardrobeError } from './wardrobe-error.mapper';
import type { WardrobeGateway } from './wardrobe.gateway';
import { isRecord, requireString, requireTimestamp, WardrobeDataInvalidError } from './wardrobe-item.parser';
import {
  encodeWardrobeListCursor,
  parseWardrobeIdempotencyKey,
  parseWardrobeListCursor,
  parseWardrobeListLimit,
  parseWardrobeUuid,
} from './wardrobe-item.validation';
import { parseSavedLook } from './saved-look.parser';
import type { SavedLook, SavedLookList } from './saved-look.types';
import { parseCreateSavedLookInput, parseUpdateSavedLookInput } from './saved-look.validation';
import { WARDROBE_GATEWAY } from './wardrobe.tokens';

@Injectable()
export class SavedLookService {
  public constructor(
    @Inject(WARDROBE_GATEWAY)
    private readonly gateway: WardrobeGateway,
  ) {}

  public async list(
    context: AuthenticatedRequestContext,
    cursorValue: unknown,
    limitValue: unknown,
  ): Promise<SavedLookList> {
    try {
      const cursor = parseWardrobeListCursor(cursorValue);
      const limit = parseWardrobeListLimit(limitValue);
      const raw = await this.gateway.execute('list_saved_looks', {
        p_actor: context.actor.id,
        p_cursor_updated_at: cursor?.createdAt ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: limit,
      });
      if (!isRecord(raw) || !Array.isArray(raw['items'])) throw new WardrobeDataInvalidError();
      const next = raw['nextCursor'];
      let nextCursor: { createdAt: string; id: string } | null = null;
      if (next !== null) {
        if (!isRecord(next)) throw new WardrobeDataInvalidError();
        nextCursor = { createdAt: requireTimestamp(next, 'updatedAt'), id: requireString(next, 'id') };
      }
      return {
        items: raw['items'].map(parseSavedLook),
        nextCursor: encodeWardrobeListCursor(nextCursor),
      };
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }

  public async create(
    context: AuthenticatedRequestContext,
    idempotencyKeyValue: unknown,
    body: unknown,
  ): Promise<SavedLook> {
    try {
      const input = parseCreateSavedLookInput(body, idempotencyKeyValue);
      return parseSavedLook(
        await this.gateway.execute('create_saved_look', {
          p_actor: context.actor.id,
          p_name: input.name,
          p_items: input.items,
          p_idempotency_key: input.idempotencyKey,
        }),
      );
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }

  public async get(context: AuthenticatedRequestContext, lookIdValue: unknown): Promise<SavedLook> {
    try {
      const lookId = parseWardrobeUuid(lookIdValue);
      return parseSavedLook(
        await this.gateway.execute('get_saved_look', { p_actor: context.actor.id, p_look_id: lookId }),
      );
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }

  public async update(
    context: AuthenticatedRequestContext,
    lookIdValue: unknown,
    body: unknown,
  ): Promise<SavedLook> {
    try {
      const lookId = parseWardrobeUuid(lookIdValue);
      const patch = parseUpdateSavedLookInput(body);
      return parseSavedLook(
        await this.gateway.execute('update_saved_look', {
          p_actor: context.actor.id,
          p_look_id: lookId,
          p_patch: patch,
        }),
      );
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }

  public async delete(
    context: AuthenticatedRequestContext,
    lookIdValue: unknown,
    idempotencyKeyValue: unknown,
  ): Promise<{ readonly success: true }> {
    try {
      const lookId = parseWardrobeUuid(lookIdValue);
      const idempotencyKey = parseWardrobeIdempotencyKey(idempotencyKeyValue);
      const result = await this.gateway.execute('delete_saved_look', {
        p_actor: context.actor.id,
        p_look_id: lookId,
        p_idempotency_key: idempotencyKey,
      });
      if (!isRecord(result) || result['success'] !== true) throw new WardrobeDataInvalidError();
      return { success: true };
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }
}
