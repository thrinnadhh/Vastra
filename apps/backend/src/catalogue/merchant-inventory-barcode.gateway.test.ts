import { describe, expect, it } from 'vitest';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SupabaseMerchantInventoryBarcodeGateway } from './merchant-inventory-barcode.gateway';

interface ScriptedResponse {
  readonly data: unknown;
  readonly error: { readonly code?: string } | null;
}

class Query {
  public constructor(private readonly response: ScriptedResponse) {}

  public select(): this {
    return this;
  }

  public eq(): this {
    return this;
  }

  public is(): this {
    return this;
  }

  public maybeSingle(): Promise<ScriptedResponse> {
    return Promise.resolve(this.response);
  }
}

class ScriptedClient {
  public readonly requestedTables: string[] = [];

  public constructor(
    private readonly responses: Readonly<Record<string, readonly ScriptedResponse[]>>,
  ) {}

  public from(table: string): Query {
    this.requestedTables.push(table);
    const callsForTable = this.requestedTables.filter((candidate) => candidate === table).length;
    const response = this.responses[table]?.[callsForTable - 1];
    if (response === undefined) {
      throw new TypeError(`Missing scripted response for ${table}`);
    }
    return new Query(response);
  }
}

const barcode = {
  id: '60000000-0000-4000-8000-000000000001',
  variant_id: '50000000-0000-4000-8000-000000000001',
  barcode_value: '8901234567890',
  barcode_type: 'EAN13',
  source: 'MANUFACTURER',
  is_primary: true,
};

describe('SupabaseMerchantInventoryBarcodeGateway', () => {
  it('returns not found when a global barcode belongs to another shop', async () => {
    const client = new ScriptedClient({
      variant_barcodes: [{ data: barcode, error: null }],
      product_variants: [{ data: null, error: null }],
    });
    const gateway = new SupabaseMerchantInventoryBarcodeGateway();

    const result = await gateway.findOwnedInventoryByBarcode(
      client as unknown as SupabaseClient,
      '20000000-0000-4000-8000-000000000001',
      '8901234567890',
    );

    expect(result).toBeNull();
    expect(client.requestedTables).toStrictEqual(['variant_barcodes', 'product_variants']);
  });

  it('returns an owned barcode projection with its balance', async () => {
    const client = new ScriptedClient({
      variant_barcodes: [{ data: barcode, error: null }],
      product_variants: [
        {
          data: {
            id: barcode.variant_id,
            product_id: '40000000-0000-4000-8000-000000000001',
            shop_id: '20000000-0000-4000-8000-000000000001',
            sku: 'KURTA-BLUE-M',
            colour_name: 'Blue',
            size_label: 'M',
            is_active: true,
          },
          error: null,
        },
      ],
      products: [
        {
          data: {
            id: '40000000-0000-4000-8000-000000000001',
            name: 'Blue Kurta',
            slug: 'blue-kurta',
            brand: 'Vastra',
            is_active: true,
          },
          error: null,
        },
      ],
      inventory_balances: [
        {
          data: {
            stock_on_hand: 10,
            reserved_quantity: 2,
            damaged_quantity: 1,
            reorder_level: 3,
            version: 4,
            last_counted_at: null,
            updated_at: '2026-08-05T08:00:00.000Z',
          },
          error: null,
        },
      ],
    });
    const gateway = new SupabaseMerchantInventoryBarcodeGateway();

    const result = await gateway.findOwnedInventoryByBarcode(
      client as unknown as SupabaseClient,
      '20000000-0000-4000-8000-000000000001',
      '8901234567890',
    );

    expect(result?.variant.sku).toBe('KURTA-BLUE-M');
    expect(result?.balance?.stockOnHand).toBe(10);
  });
});
