import {
  CUSTOMER_DISCOVERY_LIMITS,
  CUSTOMER_DISCOVERY_MEDIA,
} from './customer-discovery-performance';

describe('customer discovery low-end performance contract', () => {
  it('bounds server-backed lists instead of requesting unbounded discovery payloads', () => {
    expect(CUSTOMER_DISCOVERY_LIMITS).toEqual({
      searchPageSize: 20,
      shopCataloguePageSize: 20,
      nearbyShopLimit: 50,
      recentSearchLimit: 5,
    });
    expect(CUSTOMER_DISCOVERY_LIMITS.searchPageSize).toBeLessThanOrEqual(20);
    expect(CUSTOMER_DISCOVERY_LIMITS.shopCataloguePageSize).toBeLessThanOrEqual(20);
    expect(CUSTOMER_DISCOVERY_LIMITS.nearbyShopLimit).toBeLessThanOrEqual(50);
  });

  it('keeps the product hero at deterministic fixed geometry', () => {
    expect(CUSTOMER_DISCOVERY_MEDIA.productHeroHeight).toBe(360);
  });
});
