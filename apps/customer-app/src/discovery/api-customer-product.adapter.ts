import type { ApiClient } from '@vastra/api-client';

import type {
  CustomerAddToCartResult,
  CustomerProductDetail,
  CustomerProductDetailResult,
  CustomerProductFailureKind,
  CustomerProductPort,
} from './customer-product.types';

interface ProductApiResponse {
  readonly data: {
    readonly data: {
      readonly product: {
        readonly id: string;
        readonly shopId: string;
        readonly categoryId: string;
        readonly name: string;
        readonly slug: string;
        readonly brand: string | null;
        readonly genderCategory: 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX';
        readonly shop: {
          readonly id: string;
          readonly name: string;
          readonly slug: string;
          readonly operationalStatus: string;
          readonly acceptsOnlineOrders: boolean;
        };
        readonly description: string | null;
        readonly material: string | null;
        readonly styleTags: readonly string[];
        readonly occasionTags: readonly string[];
        readonly careInstructions: string | null;
        readonly returnEligible: boolean;
        readonly returnWindowDays: number;
        readonly images: readonly {
          readonly id: string;
          readonly imageType: string;
          readonly altText: string | null;
          readonly displayOrder: number;
          readonly isPrimary: boolean;
          readonly imageUrl: string;
          readonly thumbnailUrl: string | null;
        }[];
        readonly variants: readonly {
          readonly id: string;
          readonly sku: string;
          readonly colourName: string | null;
          readonly colourHex: string | null;
          readonly sizeLabel: string | null;
          readonly mrpPaise: number;
          readonly sellingPricePaise: number;
          readonly attributes: Readonly<Record<string, unknown>>;
          readonly availableQuantity: number;
          readonly isAvailable: boolean;
        }[];
      };
    };
  };
}

interface CartApiResponse {
  readonly data: {
    readonly data: {
      readonly cart: {
        readonly shop: { readonly id: string };
        readonly itemCount: number;
      } | null;
    };
  };
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function failureKind(error: unknown): CustomerProductFailureKind {
  if (!isRecord(error) || !isRecord(error['normalized'])) {
    return 'ERROR';
  }

  const normalized = error['normalized'];
  const kind = normalized['kind'];
  const code = normalized['code'];
  const status = normalized['status'];

  if (kind === 'TRANSPORT' || kind === 'TIMEOUT') return 'OFFLINE';
  if (status === 404 || code === 'PRODUCT_NOT_FOUND') return 'NOT_FOUND';
  if (code === 'CART_SHOP_CONFLICT') return 'CART_CONFLICT';
  if (code === 'INSUFFICIENT_INVENTORY' || code === 'VARIANT_NOT_FOUND') return 'UNAVAILABLE';
  return 'ERROR';
}

function mapProduct(product: ProductApiResponse['data']['data']['product']): CustomerProductDetail {
  return {
    id: product.id,
    shopId: product.shopId,
    categoryId: product.categoryId,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    gender: product.genderCategory,
    shop: product.shop,
    description: product.description,
    material: product.material,
    styleTags: product.styleTags,
    occasionTags: product.occasionTags,
    careInstructions: product.careInstructions,
    returnEligible: product.returnEligible,
    returnWindowDays: product.returnWindowDays,
    images: [...product.images].sort((left, right) => left.displayOrder - right.displayOrder),
    variants: product.variants,
  };
}

export class ApiCustomerProductAdapter implements CustomerProductPort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async getProduct(productId: string): Promise<CustomerProductDetailResult> {
    try {
      const responseValue: unknown = await this.apiClient.request('getCustomerCatalogueProduct', {
        path: { productId },
      });
      const response = responseValue as ProductApiResponse;
      return { kind: 'SUCCESS', product: mapProduct(response.data.data.product) };
    } catch (error: unknown) {
      return { kind: 'FAILURE', failureKind: failureKind(error) };
    }
  }

  public async addToCart(
    variantId: string,
    quantity: number,
    replaceExistingCart: boolean,
  ): Promise<CustomerAddToCartResult> {
    try {
      const responseValue: unknown = await this.apiClient.request('setCustomerCartItem', {
        body: { variantId, quantity, replaceExistingCart },
      });
      const response = responseValue as CartApiResponse;
      const cart = response.data.data.cart;

      if (cart === null) {
        return { kind: 'FAILURE', failureKind: 'ERROR' };
      }

      return {
        kind: 'SUCCESS',
        cartItemCount: cart.itemCount,
        cartShopId: cart.shop.id,
      };
    } catch (error: unknown) {
      return { kind: 'FAILURE', failureKind: failureKind(error) };
    }
  }
}
