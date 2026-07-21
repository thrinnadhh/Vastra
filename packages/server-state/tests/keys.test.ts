import { describe, expect, it } from 'vitest';

import {
  adminKeys,
  asAccountId,
  asAuthorizationEpoch,
  asLocationScopeId,
  captainKeys,
  customerKeys,
  merchantKeys,
  mutationKeys,
  normalizeQueryFilters,
} from '../src/index';

describe('typed query-key factories', () => {
  const accountId = asAccountId('10000000-0000-4000-8000-000000000001');
  const locationScopeId = asLocationScopeId('location-scope-1');
  const authorizationEpoch = asAuthorizationEpoch('authorization-epoch-1');
  const shopId = '20000000-0000-4000-8000-000000000001';
  const resourceId = '30000000-0000-4000-8000-000000000001';
  const filters = normalizeQueryFilters({ status: 'ACTIVE', sort: 'RECENT' });

  it('partitions every customer key by actor and account', () => {
    const keys = [
      customerKeys.root(accountId),
      customerKeys.currentAccount(accountId),
      customerKeys.home(accountId, locationScopeId),
      customerKeys.search(accountId, locationScopeId, filters),
      customerKeys.nearbyShops(accountId, locationScopeId, filters),
      customerKeys.shop(accountId, locationScopeId, shopId),
      customerKeys.shopProducts(accountId, locationScopeId, shopId, filters),
      customerKeys.product(accountId, locationScopeId, resourceId),
      customerKeys.favouriteShops(accountId),
      customerKeys.addresses(accountId),
      customerKeys.address(accountId, resourceId),
      customerKeys.cart(accountId),
      customerKeys.checkoutQuote(accountId, resourceId),
      customerKeys.orders(accountId, filters),
      customerKeys.order(accountId, resourceId),
      customerKeys.returns(accountId, filters),
      customerKeys.returnDetail(accountId, resourceId),
      customerKeys.supportCases(accountId, filters),
      customerKeys.supportCase(accountId, resourceId),
      customerKeys.wardrobe(accountId, filters),
      customerKeys.wardrobeItem(accountId, resourceId),
      customerKeys.savedLooks(accountId, filters),
      customerKeys.savedLook(accountId, resourceId),
      customerKeys.groupStyleRooms(accountId, filters),
      customerKeys.groupStyleRoom(accountId, resourceId),
    ];

    expect(keys).toHaveLength(25);
    expect(customerKeys.root(accountId)).toEqual(['customer', accountId]);
    expect(keys.every((key) => key[1] === accountId)).toBe(true);
    expect(customerKeys.checkoutQuotes(accountId)).toEqual([
      'customer',
      accountId,
      'checkoutQuote',
    ]);
  });

  it('partitions merchant, captain, and admin keys by their authorization scope', () => {
    const merchant = [
      merchantKeys.root(accountId, shopId),
      merchantKeys.currentAccount(accountId, shopId),
      merchantKeys.dashboard(accountId, shopId),
      merchantKeys.orderQueue(accountId, shopId, filters),
      merchantKeys.order(accountId, shopId, resourceId),
      merchantKeys.packingList(accountId, shopId, resourceId),
      merchantKeys.alert(accountId, shopId, resourceId),
      merchantKeys.inventory(accountId, shopId, filters),
      merchantKeys.inventoryItem(accountId, shopId, resourceId),
      merchantKeys.returns(accountId, shopId, filters),
      merchantKeys.returnDetail(accountId, shopId, resourceId),
      merchantKeys.supportCases(accountId, shopId, filters),
    ];
    const captain = [
      captainKeys.root(accountId),
      captainKeys.currentAccount(accountId),
      captainKeys.availability(accountId),
      captainKeys.offers(accountId),
      captainKeys.activeDelivery(accountId),
      captainKeys.delivery(accountId, resourceId),
      captainKeys.history(accountId, filters),
      captainKeys.earnings(accountId, filters),
      captainKeys.supportCases(accountId, filters),
    ];
    const admin = [
      adminKeys.root(accountId, authorizationEpoch),
      adminKeys.dashboard(accountId, authorizationEpoch),
      adminKeys.collection(accountId, authorizationEpoch, 'orders', filters),
      adminKeys.detail(accountId, authorizationEpoch, 'orders', resourceId),
      adminKeys.audit(accountId, authorizationEpoch, filters),
    ];

    expect(merchant).toHaveLength(12);
    expect(merchant.every((key) => key[2] === shopId)).toBe(true);
    expect(captain).toHaveLength(9);
    expect(captainKeys.root(accountId)).toEqual(['captain', accountId]);
    expect(captain.every((key) => key[1] === accountId)).toBe(true);
    expect(admin).toHaveLength(5);
    expect(admin.every((key) => key[2] === authorizationEpoch)).toBe(true);
  });

  it('normalizes filter objects deterministically and rejects unsafe values', () => {
    expect(
      normalizeQueryFilters({ sort: 'RECENT', nested: { pageSize: 20, active: true } }),
    ).toEqual(normalizeQueryFilters({ nested: { active: true, pageSize: 20 }, sort: 'RECENT' }));
    expect(() => normalizeQueryFilters({ latitude: Number.NaN })).toThrow(
      'Query filters must contain only finite JSON values',
    );
  });

  it('keeps mutation variables and idempotency keys outside mutation keys', () => {
    expect(mutationKeys.customer(accountId, 'orders', 'place')).toEqual([
      'customer',
      accountId,
      'mutation',
      'orders',
      'place',
    ]);
    expect(mutationKeys.merchant(accountId, shopId, 'orders', 'accept')).toEqual([
      'merchant',
      accountId,
      shopId,
      'mutation',
      'orders',
      'accept',
    ]);
    expect(mutationKeys.captain(accountId, 'delivery', 'complete')).toEqual([
      'captain',
      accountId,
      'mutation',
      'delivery',
      'complete',
    ]);
    expect(mutationKeys.admin(accountId, authorizationEpoch, 'orders', 'recover')).toEqual([
      'admin',
      accountId,
      authorizationEpoch,
      'mutation',
      'orders',
      'recover',
    ]);
  });
});
