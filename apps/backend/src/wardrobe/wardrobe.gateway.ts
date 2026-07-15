import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';

const WARDROBE_MEDIA_BUCKET = 'wardrobe-media';
const SIGNED_URL_TTL_SECONDS = 300;

export interface WardrobeGateway {
  execute(functionName: string, args: Record<string, unknown>): Promise<unknown>;
  createSignedImageUrl(objectKey: string): Promise<string>;
  removeObject(objectKey: string): Promise<void>;
  createPublicProductImageUrl?(objectKey: string): string;
}

export class WardrobeGatewayError extends Error {
  public constructor(public readonly databaseCode: string | null) {
    super('Wardrobe gateway request failed');
    this.name = 'WardrobeGatewayError';
  }
}

export class WardrobeStorageError extends Error {
  public constructor() {
    super('Wardrobe storage request failed');
    this.name = 'WardrobeStorageError';
  }
}

@Injectable()
export class SupabaseWardrobeGateway implements WardrobeGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async execute(functionName: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await this.client.rpc(functionName, args);

      if (response.error !== null) {
        throw new WardrobeGatewayError(response.error.code);
      }

      return response.data;
    } catch (error: unknown) {
      if (error instanceof WardrobeGatewayError) {
        throw error;
      }

      throw new WardrobeGatewayError(null);
    }
  }

  public async createSignedImageUrl(objectKey: string): Promise<string> {
    try {
      const response = await this.client.storage
        .from(WARDROBE_MEDIA_BUCKET)
        .createSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS);

      if (response.error !== null) {
        throw new WardrobeStorageError();
      }

      return response.data.signedUrl;
    } catch (error: unknown) {
      if (error instanceof WardrobeStorageError) {
        throw error;
      }

      throw new WardrobeStorageError();
    }
  }

  public createPublicProductImageUrl(objectKey: string): string {
    return this.client.storage.from('product-images').getPublicUrl(objectKey).data.publicUrl;
  }

  public async removeObject(objectKey: string): Promise<void> {
    try {
      const response = await this.client.storage.from(WARDROBE_MEDIA_BUCKET).remove([objectKey]);

      if (response.error !== null) {
        throw new WardrobeStorageError();
      }
    } catch (error: unknown) {
      if (error instanceof WardrobeStorageError) {
        throw error;
      }

      throw new WardrobeStorageError();
    }
  }
}
