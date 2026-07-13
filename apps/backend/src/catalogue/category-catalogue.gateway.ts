import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import type { MerchantCatalogueCategorySnapshot } from './category-catalogue.types';

export interface CategoryCatalogueGateway {
  findActiveCategories(
    client: SupabaseClient,
  ): Promise<readonly MerchantCatalogueCategorySnapshot[]>;

  findActiveCategoryById(
    client: SupabaseClient,
    categoryId: string,
  ): Promise<MerchantCatalogueCategorySnapshot | null>;
}

export class CategoryCatalogueGatewayUnavailableError extends Error {
  public constructor() {
    super('Category catalogue provider unavailable');
    this.name = 'CategoryCatalogueGatewayUnavailableError';
  }
}

export class CategoryCatalogueDataInvalidError extends Error {
  public constructor() {
    super('Category catalogue data invalid');
    this.name = 'CategoryCatalogueDataInvalidError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CategoryCatalogueDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CategoryCatalogueDataInvalidError();
  }

  return value;
}

function requireSafeNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const rawValue = record[key];
  const value =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim().length > 0
        ? Number(rawValue)
        : Number.NaN;

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CategoryCatalogueDataInvalidError();
  }

  return value;
}

function parseCategory(value: unknown): MerchantCatalogueCategorySnapshot {
  if (!isRecord(value)) {
    throw new CategoryCatalogueDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    parentId: requireNullableString(value, 'parent_id'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
    description: requireNullableString(value, 'description'),
    iconObjectKey: requireNullableString(value, 'icon_object_key'),
    displayOrder: requireSafeNonNegativeInteger(value, 'display_order'),
  };
}

function parseCategories(value: unknown): readonly MerchantCatalogueCategorySnapshot[] {
  if (!Array.isArray(value)) {
    throw new CategoryCatalogueDataInvalidError();
  }

  return value.map((category) => parseCategory(category));
}

function parseNullableCategory(value: unknown): MerchantCatalogueCategorySnapshot | null {
  if (value === null) {
    return null;
  }

  return parseCategory(value);
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CategoryCatalogueGatewayUnavailableError ||
    error instanceof CategoryCatalogueDataInvalidError
  ) {
    throw error;
  }

  throw new CategoryCatalogueGatewayUnavailableError();
}

const CATEGORY_SELECT = [
  'id',
  'parent_id',
  'name',
  'slug',
  'description',
  'icon_object_key',
  'display_order',
].join(', ');

@Injectable()
export class SupabaseCategoryCatalogueGateway implements CategoryCatalogueGateway {
  public async findActiveCategories(
    client: SupabaseClient,
  ): Promise<readonly MerchantCatalogueCategorySnapshot[]> {
    try {
      const response = await client
        .from('categories')
        .select(CATEGORY_SELECT)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })
        .order('id', { ascending: true });

      if (response.error !== null) {
        throw new CategoryCatalogueGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseCategories(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findActiveCategoryById(
    client: SupabaseClient,
    categoryId: string,
  ): Promise<MerchantCatalogueCategorySnapshot | null> {
    try {
      const response = await client
        .from('categories')
        .select(CATEGORY_SELECT)
        .eq('id', categoryId)
        .eq('is_active', true)
        .maybeSingle();

      if (response.error !== null) {
        throw new CategoryCatalogueGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseNullableCategory(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
