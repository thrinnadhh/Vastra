export type CustomerDiscoveryIntent =
  | { readonly kind: 'SEARCH'; readonly initialQuery?: string }
  | { readonly kind: 'CATEGORY'; readonly categoryId: string }
  | { readonly kind: 'SHOP'; readonly shopId: string }
  | { readonly kind: 'PRODUCT'; readonly productId: string };
