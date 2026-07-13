export const SHOP_VERIFICATION_STATUSES = ['PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED'] as const;

export type ShopVerificationStatus = (typeof SHOP_VERIFICATION_STATUSES)[number];

export const SHOP_OPERATIONAL_STATUSES = [
  'OPEN',
  'BUSY',
  'TEMPORARILY_CLOSED',
  'CLOSED_FOR_DAY',
  'PAUSED',
  'SUSPENDED',
] as const;

export type ShopOperationalStatus = (typeof SHOP_OPERATIONAL_STATUSES)[number];

export interface MerchantCatalogueShopSnapshot {
  readonly id: string;
  readonly shopCode: string;
  readonly name: string;
  readonly slug: string;
  readonly verificationStatus: ShopVerificationStatus;
  readonly operationalStatus: ShopOperationalStatus;
  readonly acceptsOnlineOrders: boolean;
  readonly serviceRadiusMeters: number;
  readonly minimumOrderPaise: number;
  readonly averagePreparationMinutes: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface ListMerchantCatalogueShopsResponse {
  readonly success: true;
  readonly data: {
    readonly shops: readonly MerchantCatalogueShopSnapshot[];
  };
  readonly meta: ResponseMeta;
}

export interface GetMerchantCatalogueShopResponse {
  readonly success: true;
  readonly data: {
    readonly shop: MerchantCatalogueShopSnapshot;
  };
  readonly meta: ResponseMeta;
}
