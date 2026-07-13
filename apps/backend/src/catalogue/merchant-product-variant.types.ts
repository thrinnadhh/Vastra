export interface MerchantProductVariantSnapshot {
  readonly id: string;
  readonly productId: string;
  readonly shopId: string;
  readonly sku: string;
  readonly colourName: string | null;
  readonly colourHex: string | null;
  readonly sizeLabel: string | null;
  readonly mrpPaise: number;
  readonly sellingPricePaise: number;
  readonly costPricePaise: number | null;
  readonly weightGrams: number | null;
  readonly lengthCm: number | null;
  readonly widthCm: number | null;
  readonly heightCm: number | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateMerchantProductVariantInput {
  readonly sku: string;
  readonly colourName: string | null;
  readonly colourHex: string | null;
  readonly sizeLabel: string | null;
  readonly mrpPaise: number;
  readonly sellingPricePaise: number;
  readonly costPricePaise: number | null;
  readonly weightGrams: number | null;
  readonly lengthCm: number | null;
  readonly widthCm: number | null;
  readonly heightCm: number | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly isActive: boolean;
}

export interface UpdateMerchantProductVariantInput {
  readonly sku?: string;
  readonly colourName?: string | null;
  readonly colourHex?: string | null;
  readonly sizeLabel?: string | null;
  readonly mrpPaise?: number;
  readonly sellingPricePaise?: number;
  readonly costPricePaise?: number | null;
  readonly weightGrams?: number | null;
  readonly lengthCm?: number | null;
  readonly widthCm?: number | null;
  readonly heightCm?: number | null;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly isActive?: boolean;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface ListMerchantProductVariantsResponse {
  readonly success: true;
  readonly data: {
    readonly variants: readonly MerchantProductVariantSnapshot[];
  };
  readonly meta: ResponseMeta;
}

export interface MerchantProductVariantResponse {
  readonly success: true;
  readonly data: {
    readonly variant: MerchantProductVariantSnapshot;
  };
  readonly meta: ResponseMeta;
}

export interface DeactivateMerchantProductVariantResponse {
  readonly success: true;
  readonly data: {
    readonly deactivatedVariantId: string;
  };
  readonly meta: ResponseMeta;
}
