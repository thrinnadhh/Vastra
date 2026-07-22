import type { CustomerRoute, UUID } from './customer-routes';
import { isUuid } from './customer-routes';

export type CustomerDeepLinkResult =
  | { readonly kind: 'ROUTE'; readonly route: CustomerRoute }
  | { readonly kind: 'INVALID' }
  | { readonly kind: 'WRONG_APPLICATION' }
  | { readonly kind: 'RESERVED' };

function asUuid(value: string): UUID | null {
  return isUuid(value) ? value : null;
}

export function parseCustomerDeepLink(value: string): CustomerDeepLinkResult {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return { kind: 'INVALID' };
  }

  const scheme = url.protocol.toLowerCase();
  if (scheme !== 'vastra:') {
    return scheme === 'vastra-merchant:' || scheme === 'vastra-captain:'
      ? { kind: 'WRONG_APPLICATION' }
      : { kind: 'INVALID' };
  }

  if (url.username.length > 0 || url.password.length > 0 || url.port.length > 0 || url.search.length > 0 || url.hash.length > 0) {
    return { kind: 'INVALID' };
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);

  if (host === 'group-style') {
    return { kind: 'RESERVED' };
  }

  if (segments.length !== 1) {
    return { kind: 'INVALID' };
  }

  const resourceId = asUuid(segments[0] ?? '');
  if (resourceId === null) {
    return { kind: 'INVALID' };
  }

  switch (host) {
    case 'product':
      return {
        kind: 'ROUTE',
        route: { scope: 'DISCOVERY', name: 'ProductDetail', params: { productId: resourceId } },
      };
    case 'shop':
      return {
        kind: 'ROUTE',
        route: { scope: 'DISCOVERY', name: 'ShopDetail', params: { shopId: resourceId } },
      };
    case 'order':
      return {
        kind: 'ROUTE',
        route: { scope: 'ORDERS', name: 'OrderDetail', params: { orderId: resourceId } },
      };
    case 'look':
      return {
        kind: 'ROUTE',
        route: { scope: 'STYLE', name: 'LookDetail', params: { lookId: resourceId } },
      };
    default:
      return { kind: 'INVALID' };
  }
}
