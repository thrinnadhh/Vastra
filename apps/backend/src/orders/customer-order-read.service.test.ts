import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerOrderReadGateway,
  CustomerOrderReadNotFoundError,
} from './customer-order-read.gateway';
import { CustomerOrderReadService } from './customer-order-read.service';
import type {
  CustomerOrderDetail,
  CustomerOrderListPage,
  CustomerOrderListQuery,
} from './customer-order-read.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const SHOP_ID = '30000000-0000-4000-8000-000000000001';
const CART_ID = '40000000-0000-4000-8000-000000000001';
const QUOTE_ID = '50000000-0000-4000-8000-000000000001';
const ITEM_ID = '60000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '70000000-0000-4000-8000-000000000001';
const VARIANT_ID = '80000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'customer@example.test',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  },
  accessToken: 'customer-token',
  supabase: emptyClient,
};

const detail: CustomerOrderDetail = {
  id: ORDER_ID,
  orderNumber: 'VST-TEST-ORDER',
  cartId: CART_ID,
  quoteId: QUOTE_ID,
  shop: {
    id: SHOP_ID,
    name: 'Read Shop',
    slug: 'read-shop',
  },
  address: {
    id: '90000000-0000-4000-8000-000000000001',
    label: 'Home',
    recipientName: 'Customer',
    phoneNumber: '9000000001',
    line1: 'Order Street',
    line2: null,
    landmark: null,
    area: 'Tirupati',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    postalCode: '517501',
    countryCode: 'IN',
    latitude: 13.6288,
    longitude: 79.4192,
  },
  status: 'WAITING_FOR_MERCHANT',
  paymentStatus: 'COD_PENDING',
  fulfilmentType: 'DELIVERY',
  items: [
    {
      id: ITEM_ID,
      productId: PRODUCT_ID,
      variantId: VARIANT_ID,
      productName: 'Read Kurta',
      sku: 'READ-KURTA-M',
      colourName: 'Blue',
      sizeLabel: 'M',
      imageObjectKey: null,
      quantity: 1,
      unitMrpPaise: 60000,
      unitSellingPricePaise: 50000,
      discountPaise: 0,
      totalPaise: 50000,
    },
  ],
  itemCount: 1,
  totals: {
    subtotalPaise: 50000,
    productDiscountPaise: 0,
    couponDiscountPaise: 0,
    deliveryFeePaise: 0,
    platformFeePaise: 0,
    taxPaise: 0,
    totalPaise: 50000,
  },
  estimatedDeliveryAt: '2026-07-15T12:45:00.000Z',
  customerNote: null,
  cancellationReasonCode: null,
  cancellationNote: null,
  history: [
    {
      id: '1',
      previousStatus: null,
      newStatus: 'PAYMENT_PENDING',
      changedByRole: 'SYSTEM',
      reasonCode: null,
      note: null,
      createdAt: '2026-07-15T12:00:00.000Z',
    },
    {
      id: '2',
      previousStatus: 'PAYMENT_PENDING',
      newStatus: 'WAITING_FOR_MERCHANT',
      changedByRole: 'CUSTOMER',
      reasonCode: null,
      note: null,
      createdAt: '2026-07-15T12:00:01.000Z',
    },
  ],
  placedAt: '2026-07-15T12:00:01.000Z',
  acceptedAt: null,
  readyAt: null,
  pickedUpAt: null,
  deliveredAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: '2026-07-15T12:00:00.000Z',
  updatedAt: '2026-07-15T12:00:01.000Z',
};

class StubGateway implements CustomerOrderReadGateway {
  public client: SupabaseClient | null = null;
  public actorId: string | null = null;
  public listQuery: CustomerOrderListQuery | null = null;
  public requestedOrderId: string | null = null;
  public shouldMiss = false;

  public listCustomerOrders(
    client: SupabaseClient,
    actorId: string,
    query: CustomerOrderListQuery,
  ): Promise<CustomerOrderListPage> {
    this.client = client;
    this.actorId = actorId;
    this.listQuery = query;

    return Promise.resolve({
      orders: [
        {
          id: detail.id,
          orderNumber: detail.orderNumber,
          shop: detail.shop,
          status: detail.status,
          paymentStatus: detail.paymentStatus,
          fulfilmentType: detail.fulfilmentType,
          itemCount: detail.itemCount,
          previewImageObjectKey: null,
          totals: detail.totals,
          estimatedDeliveryAt: detail.estimatedDeliveryAt,
          placedAt: detail.placedAt,
          createdAt: detail.createdAt,
        },
      ],
      nextOffset: 20,
    });
  }

  public getCustomerOrder(
    client: SupabaseClient,
    actorId: string,
    orderId: string,
  ): Promise<CustomerOrderDetail> {
    this.client = client;
    this.actorId = actorId;
    this.requestedOrderId = orderId;

    if (this.shouldMiss) {
      return Promise.reject(new CustomerOrderReadNotFoundError());
    }

    return Promise.resolve(detail);
  }
}

function readErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw new TypeError('Expected HttpException');
  }

  const response = error.getResponse();

  if (typeof response !== 'object') {
    throw new TypeError('Expected object response');
  }

  const body = response as Record<string, unknown>;
  const errorBody = body['error'];

  if (typeof errorBody !== 'object' || errorBody === null || Array.isArray(errorBody)) {
    throw new TypeError('Expected error body');
  }

  const code = (errorBody as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('CustomerOrderReadService', () => {
  it('lists only through the authenticated client and returns an opaque cursor', async () => {
    const gateway = new StubGateway();
    const service = new CustomerOrderReadService(gateway);

    const response = await service.listOrders(context, undefined, undefined);

    expect(response.data.orders).toHaveLength(1);
    expect(response.data.nextCursor).toBe('djE6MjA');
    expect(gateway.client).toBe(emptyClient);
    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.listQuery).toStrictEqual({ offset: 0, limit: 20 });
  });

  it('returns one owned order detail', async () => {
    const gateway = new StubGateway();
    const service = new CustomerOrderReadService(gateway);

    const response = await service.getOrder(context, ORDER_ID);

    expect(response.data.order).toStrictEqual(detail);
    expect(gateway.requestedOrderId).toBe(ORDER_ID);
    expect(gateway.actorId).toBe(ACTOR_ID);
  });

  it('maps an invalid cursor to validation error', async () => {
    const gateway = new StubGateway();
    const service = new CustomerOrderReadService(gateway);

    await expect(service.listOrders(context, 'invalid', undefined)).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'VALIDATION_ERROR',
    );
  });

  it('maps an invisible order to ORDER_NOT_FOUND', async () => {
    const gateway = new StubGateway();
    gateway.shouldMiss = true;
    const service = new CustomerOrderReadService(gateway);

    await expect(service.getOrder(context, ORDER_ID)).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'ORDER_NOT_FOUND',
    );
  });
});
