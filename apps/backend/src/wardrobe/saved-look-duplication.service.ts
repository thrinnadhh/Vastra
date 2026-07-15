import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { rethrowWardrobeError } from './wardrobe-error.mapper';
import type { WardrobeGateway } from './wardrobe.gateway';
import { parseWardrobeIdempotencyKey, parseWardrobeUuid } from './wardrobe-item.validation';
import { parseSavedLook } from './saved-look.parser';
import type { SavedLook } from './saved-look.types';
import { parseDuplicateSavedLookName } from './saved-look.validation';
import { WARDROBE_GATEWAY } from './wardrobe.tokens';

@Injectable()
export class SavedLookDuplicationService {
  public constructor(
    @Inject(WARDROBE_GATEWAY)
    private readonly gateway: WardrobeGateway,
  ) {}

  public async duplicate(
    context: AuthenticatedRequestContext,
    lookIdValue: unknown,
    idempotencyKeyValue: unknown,
    body: unknown,
  ): Promise<SavedLook> {
    try {
      const lookId = parseWardrobeUuid(lookIdValue);
      const idempotencyKey = parseWardrobeIdempotencyKey(idempotencyKeyValue);
      const name = parseDuplicateSavedLookName(body);
      return parseSavedLook(
        await this.gateway.execute('duplicate_saved_look', {
          p_actor: context.actor.id,
          p_source_look_id: lookId,
          p_name: name,
          p_idempotency_key: idempotencyKey,
        }),
      );
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }
}
