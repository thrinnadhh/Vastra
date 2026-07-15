import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createInvalidWardrobeUploadRequestException,
  createWardrobeAccessDeniedException,
  createWardrobeProviderUnavailableException,
  createWardrobeStateInvalidException,
  createWardrobeUploadIdempotencyConflictException,
  createWardrobeUploadIdempotencyKeyRequiredException,
} from './wardrobe-http-error';
import {
  type WardrobeUploadGateway,
  WardrobeUploadAccessDeniedError,
  WardrobeUploadDataInvalidError,
  WardrobeUploadGatewayUnavailableError,
  WardrobeUploadIdempotencyConflictError,
} from './wardrobe-upload.gateway';
import { WARDROBE_UPLOAD_GATEWAY } from './wardrobe-upload.tokens';
import type { WardrobeUploadIntent } from './wardrobe-upload.types';
import {
  parseWardrobeUploadIntentInput,
  WardrobeUploadIdempotencyKeyRequiredError,
  WardrobeUploadValidationError,
} from './wardrobe-upload.validation';

@Injectable()
export class WardrobeUploadService {
  public constructor(
    @Inject(WARDROBE_UPLOAD_GATEWAY)
    private readonly gateway: WardrobeUploadGateway,
  ) {}

  public async createUploadIntent(
    context: AuthenticatedRequestContext,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<WardrobeUploadIntent> {
    try {
      const input = parseWardrobeUploadIntentInput(body, idempotencyKey);
      const intent = await this.gateway.createIntent(context.actor.id, input);

      if (Date.parse(intent.expiresAt) <= Date.now()) {
        throw new WardrobeUploadDataInvalidError();
      }

      const uploadUrl = await this.gateway.createSignedUploadUrl(intent.objectKey);

      return {
        uploadId: intent.uploadId,
        uploadUrl,
        expiresAt: intent.expiresAt,
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof WardrobeUploadIdempotencyKeyRequiredError) {
      throw createWardrobeUploadIdempotencyKeyRequiredException();
    }

    if (error instanceof WardrobeUploadValidationError) {
      throw createInvalidWardrobeUploadRequestException();
    }

    if (error instanceof WardrobeUploadIdempotencyConflictError) {
      throw createWardrobeUploadIdempotencyConflictException();
    }

    if (error instanceof WardrobeUploadAccessDeniedError) {
      throw createWardrobeAccessDeniedException();
    }

    if (error instanceof WardrobeUploadDataInvalidError) {
      throw createWardrobeStateInvalidException();
    }

    if (error instanceof WardrobeUploadGatewayUnavailableError) {
      throw createWardrobeProviderUnavailableException();
    }

    throw error;
  }
}
