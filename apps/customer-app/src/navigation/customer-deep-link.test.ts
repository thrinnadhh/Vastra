import { parseCustomerDeepLink } from './customer-deep-link';

const ID = '10000000-0000-4000-8000-000000000001';

describe('parseCustomerDeepLink', () => {
  it.each([
    [
      `vastra://product/${ID}`,
      { scope: 'DISCOVERY', name: 'ProductDetail', params: { productId: ID } },
    ],
    [`vastra://shop/${ID}`, { scope: 'DISCOVERY', name: 'ShopDetail', params: { shopId: ID } }],
    [`vastra://order/${ID}`, { scope: 'ORDERS', name: 'OrderDetail', params: { orderId: ID } }],
    [`vastra://look/${ID}`, { scope: 'STYLE', name: 'LookDetail', params: { lookId: ID } }],
  ] as const)('maps %s to its canonical typed route', (url, route) => {
    expect(parseCustomerDeepLink(url)).toStrictEqual({ kind: 'ROUTE', route });
  });

  it.each([
    'not a url',
    'https://example.test/order/10000000-0000-4000-8000-000000000001',
    'vastra://order/not-a-uuid',
    `vastra://order/${ID}/extra`,
    `vastra://order/${ID}?token=secret`,
    `vastra://order/${ID}#fragment`,
    `vastra://checkout/${ID}`,
  ])('rejects invalid or non-allowlisted links: %s', (url) => {
    expect(parseCustomerDeepLink(url)).toStrictEqual({ kind: 'INVALID' });
  });

  it.each([`vastra-merchant://order/${ID}`, `vastra-captain://delivery/${ID}`])(
    'rejects a link owned by another Vastra app: %s',
    (url) => {
      expect(parseCustomerDeepLink(url)).toStrictEqual({ kind: 'WRONG_APPLICATION' });
    },
  );

  it.each(['vastra://group-style/join/invite-token', `vastra://group-style/rooms/${ID}`])(
    'keeps Group Style links reserved until their approved contracts exist: %s',
    (url) => {
      expect(parseCustomerDeepLink(url)).toStrictEqual({ kind: 'RESERVED' });
    },
  );
});
