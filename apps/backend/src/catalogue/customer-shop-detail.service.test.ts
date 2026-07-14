import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerShopDetailGateway,
  CustomerShopDetailDataInvalidError,
  CustomerShopDetailGatewayUnavailableError,
} from './customer-shop-detail.gateway';
import { CustomerShopDetailService } from './customer-shop-detail.service';
import type {
  CustomerShopDetailCore,
  CustomerShopDetailQuery,
  CustomerShopHourRecord,
} from './customer-shop-detail.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'customer@example.test',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  },
  accessToken: 'unit-token',
  supabase: emptyClient,
};

function createCore(overrides: Partial<CustomerShopDetailCore> = {}): CustomerShopDetailCore {
  return {
    id: SHOP_ID,
    name: 'Public Fashion Shop',
    slug: 'public-fashion-shop',
    description: 'Fashion close to home',
    phoneNumber: '9000000000',
    email: 'shop@example.test',
    latitude: 13.6288,
    longitude: 79.4192,
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
    distanceMeters: 250,
    serviceRadiusMeters: 5000,
    isServiceable: true,
    minimumOrderPaise: 0,
    averagePreparationMinutes: 15,
    ratingAverage: 4.5,
    ratingCount: 10,
    followerCount: 25,
    ...overrides,
  };
}

function createWednesdayHours(): readonly CustomerShopHourRecord[] {
  return [
    {
      scheduleType: 'WEEKLY',
      dayOfWeek: 3,
      specialDate: null,
      isClosed: false,
      opensAt: '09:00:00',
      closesAt: '21:00:00',
    },
  ];
}

class StubGateway implements CustomerShopDetailGateway {
  public core: CustomerShopDetailCore | null = createCore();
  public hours: readonly CustomerShopHourRecord[] = createWednesdayHours();
  public error: Error | null = null;
  public query: CustomerShopDetailQuery | null = null;
  public hoursShopId: string | null = null;

  public findPublicShopDetail(
    _client: SupabaseClient,
    query: CustomerShopDetailQuery,
  ): Promise<CustomerShopDetailCore | null> {
    void _client;
    this.query = query;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.core);
  }

  public listPublicShopHours(
    _client: SupabaseClient,
    shopId: string,
  ): Promise<readonly CustomerShopHourRecord[]> {
    void _client;
    this.hoursShopId = shopId;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.hours);
  }
}

function readCode(error: HttpException): string {
  const response: unknown = error.getResponse();

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new TypeError('Expected structured error response');
  }

  const apiError = (response as Record<string, unknown>)['error'];

  if (typeof apiError !== 'object' || apiError === null || Array.isArray(apiError)) {
    throw new TypeError('Expected structured API error');
  }

  const code = (apiError as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected API error code');
  }

  return code;
}

async function captureHttpException(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof HttpException) {
      return error;
    }

    throw error;
  }

  throw new Error('Expected promise to reject');
}

describe('CustomerShopDetailService', () => {
  let gateway: StubGateway;
  let service: CustomerShopDetailService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T05:00:00.000Z'));
    gateway = new StubGateway();
    service = new CustomerShopDetailService(gateway);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns serviceability, weekly hours, and open ordering status', async () => {
    const response = await service.getShopDetail(context, SHOP_ID, '13.6288', '79.4192');

    expect(response.data.shop.todayHours).toStrictEqual({
      date: '2026-07-15',
      dayOfWeek: 3,
      timeZone: 'Asia/Kolkata',
      source: 'WEEKLY',
      isClosed: false,
      opensAt: '09:00:00',
      closesAt: '21:00:00',
      isOpenNow: true,
    });
    expect(response.data.shop.orderingStatus).toBe('ACCEPTING_ORDERS');
    expect(response.data.shop.canPlaceOrder).toBe(true);
    expect(response.data.shop.weeklyHours).toHaveLength(7);
    expect(gateway.query).toStrictEqual({
      shopId: SHOP_ID,
      latitude: 13.6288,
      longitude: 79.4192,
    });
    expect(gateway.hoursShopId).toBe(SHOP_ID);
  });

  it('uses a special-date closure instead of weekly hours', async () => {
    gateway.hours = [
      ...createWednesdayHours(),
      {
        scheduleType: 'SPECIAL_DATE',
        dayOfWeek: null,
        specialDate: '2026-07-15',
        isClosed: true,
        opensAt: null,
        closesAt: null,
      },
    ];

    const response = await service.getShopDetail(context, SHOP_ID, '13.6288', '79.4192');

    expect(response.data.shop.todayHours.source).toBe('SPECIAL_DATE');
    expect(response.data.shop.todayHours.isOpenNow).toBe(false);
    expect(response.data.shop.orderingStatus).toBe('CLOSED');
  });

  it('rejects ordering outside the service radius', async () => {
    gateway.core = createCore({
      distanceMeters: 6000,
      isServiceable: false,
    });

    const response = await service.getShopDetail(context, SHOP_ID, '13.7', '79.5');

    expect(response.data.shop.orderingStatus).toBe('OUTSIDE_SERVICE_AREA');
    expect(response.data.shop.canPlaceOrder).toBe(false);
  });

  it('shows busy shops as orderable while open', async () => {
    gateway.core = createCore({
      operationalStatus: 'BUSY',
    });

    const response = await service.getShopDetail(context, SHOP_ID, '13.6288', '79.4192');

    expect(response.data.shop.orderingStatus).toBe('BUSY');
    expect(response.data.shop.canPlaceOrder).toBe(true);
  });

  it('rejects invalid coordinates before querying', async () => {
    const error = await captureHttpException(
      service.getShopDetail(context, SHOP_ID, '91', '79.4192'),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.query).toBeNull();
  });

  it('hides shops that are not public', async () => {
    gateway.core = null;

    const error = await captureHttpException(
      service.getShopDetail(context, SHOP_ID, '13.6288', '79.4192'),
    );

    expect(error.getStatus()).toBe(404);
    expect(readCode(error)).toBe('SHOP_NOT_FOUND');
  });

  it('maps provider failures to a retryable response', async () => {
    gateway.error = new CustomerShopDetailGatewayUnavailableError();

    const error = await captureHttpException(
      service.getShopDetail(context, SHOP_ID, '13.6288', '79.4192'),
    );

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });

  it('maps malformed shop data to an internal error', async () => {
    gateway.error = new CustomerShopDetailDataInvalidError();

    const error = await captureHttpException(
      service.getShopDetail(context, SHOP_ID, '13.6288', '79.4192'),
    );

    expect(error.getStatus()).toBe(500);
    expect(readCode(error)).toBe('CATALOGUE_STATE_INVALID');
  });
});
