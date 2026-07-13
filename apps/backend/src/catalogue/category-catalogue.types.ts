export interface MerchantCatalogueCategorySnapshot {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly iconObjectKey: string | null;
  readonly displayOrder: number;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface ListMerchantCatalogueCategoriesResponse {
  readonly success: true;
  readonly data: {
    readonly categories: readonly MerchantCatalogueCategorySnapshot[];
  };
  readonly meta: ResponseMeta;
}

export interface GetMerchantCatalogueCategoryResponse {
  readonly success: true;
  readonly data: {
    readonly category: MerchantCatalogueCategorySnapshot;
  };
  readonly meta: ResponseMeta;
}
