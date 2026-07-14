import type { SupabaseClient } from '../auth/supabase-client.type';
import { Buffer } from 'node:buffer';

import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantOrderReadGateway,
  MerchantOrderReadDataInvalidError,
  MerchantOrderReadGatewayUnavailableError,
  MerchantOrderReadNotFoundError,
} from './merchant-order-read.gateway';
import { MerchantOrderReadService } from './merchant-order-read.service';
import type {
  MerchantOrderDetail,
  MerchantOrderListPage,
  MerchantOrderListQuery,
} from './merchant-order-read.types';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_SERVICE_UNAVAILABLE = 503;

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'test-token',
  supabase: emptyClient,
};

function createDetail(): MerchantOrderDetail {
  return {
    id: ORDER_ID,
    orderNumber: 'VAS-MERCHANT-READ',
    cartId: null,
    quoteId: null,
    shop: {
      id: '30000000-0000-4000-8000-000000000001',
      name: 'Merchant Shop',
      slug: 'merchant-shop',
    },
    address: {
      id: '40000000-0000-4000-8000-000000000001',
      label: 'Home',
      recipientName: 'Customer',
      phoneNumber: '9000000001',
      line1: 'Customer Street',
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
        id: '50000000-0000-4000-8000-000000000001',
        productId: '60000000-0000-4000-8000-000000000001',
        variantId: '70000000-0000-4000-8000-000000000001',
        productName: 'Merchant Kurta',
        sku: 'MERCHANT-KURTA-M',
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
    alert: {
      id: '80000000-0000-4000-8000-000000000001',
      status: 'PENDING',
      attemptCount: 0,
      firstSentAt: null,
      lastSentAt: null,
      acknowledgedAt: null,
      expiresAt: '2026-07-15T20:15:00.000Z',
      soundName: 'vastra_new_order',
      failureReason: null,
      createdAt: '2026-07-15T20:00:00.000Z',
    },
    estimatedDeliveryAt: '2026-07-15T21:00:00.000Z',
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
        createdAt: '2026-07-15T20:00:00.000Z',
      },
      {
        id: '2',
        previousStatus: 'PAYMENT_PENDING',
        newStatus: 'WAITING_FOR_MERCHANT',
        changedByRole: 'CUSTOMER',
        reasonCode: null,
        note: 'Customer placed a COD order',
        createdAt: '2026-07-15T20:00:00.000Z',
      },
    ],
    placedAt: '2026-07-15T20:00:00.000Z',
    acceptedAt: null,
    readyAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: '2026-07-15T20:00:00.000Z',
    updatedAt: '2026-07-15T20:00:00.000Z',
  };
}

class StubGateway implements MerchantOrderReadGateway {
  public listQuery: MerchantOrderListQuery | null = null;
  public actorId: string | null = null;
  public listError: Error | null = null;
  public detailError: Error | null = null;

  public listMerchantOrders(
    client: SupabaseClient,
    merchantId: string,
    query: MerchantOrderListQuery,
  ): Promise<MerchantOrderListPage> {
    void client;
    this.actorId = merchantId;
    this.listQuery = query;

    if (this.listError !== null) {
      return Promise.reject(this.listError);
    }

    const detail = createDetail();

    return Promise.resolve({
      orders: [
        {
          id: detail.id,
          orderNumber: detail.orderNumber,
          shop: detail.shop,
          customerName: detail.address.recipientName,
          status: detail.status,
          paymentStatus: detail.paymentStatus,
          fulfilmentType: detail.fulfilmentType,
          itemCount: detail.itemCount,
          previewImageObjectKey: null,
          totals: detail.totals,
          alert: detail.alert,
          estimatedDeliveryAt: detail.estimatedDeliveryAt,
          placedAt: detail.placedAt,
          createdAt: detail.createdAt,
        },
      ],
      nextOffset: 20,
    });
  }

  public getMerchantOrder(
    client: SupabaseClient,
    merchantId: string,
    orderId: string,
  ): Promise<MerchantOrderDetail> {
    void client;
    this.actorId = merchantId;

    if (this.detailError !== null) {
      return Promise.reject(this.detailError);
    }

    if (orderId !== ORDER_ID) {
      return Promise.reject(new MerchantOrderReadNotFoundError());
    }

    return Promise.resolve(createDetail());
  }
}

function readErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw error;
  }

  const response = error.getResponse();

  if (typeof response !== 'object') {
    throw new TypeError('Expected an API error object');
  }

  const body = response as Record<string, unknown>;
  const errorValue = body['error'];

  if (typeof errorValue !== 'object' || errorValue === null) {
    throw new TypeError('Expected an API error payload');
  }

  const code = (errorValue as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected an API error code');
  }

  return code;
}

describe('merchant order read service', () => {
  it('lists merchant orders with an encoded next cursor', async () => {
    const gateway = new StubGateway();
    const service = new MerchantOrderReadService(gateway);
    const response = await service.listOrders(context, undefined, undefined);

    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.listQuery).toStrictEqual({ offset: 0, limit: 20 });
    expect(response.data.orders).toHaveLength(1);
    expect(response.data.nextCursor).toBe(Buffer.from('v1:20', 'utf8').toString('base64url'));
  });

  it('returns one owned order detail', async () => {
    const service = new MerchantOrderReadService(new StubGateway());
    const response = await service.getOrder(context, ORDER_ID);

    expect(response.data.order).toStrictEqual(createDetail());
  });

  it('maps validation failures', async () => {
    const service = new MerchantOrderReadService(new StubGateway());

    await expect(service.getOrder(context, 'invalid')).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === HTTP_BAD_REQUEST &&
        readErrorCode(error) === 'VALIDATION_ERROR',
    );
  });

  it('maps an inaccessible order to not found', async () => {
    const gateway = new StubGateway();
    gateway.detailError = new MerchantOrderReadNotFoundError();
    const service = new MerchantOrderReadService(gateway);

    await expect(service.getOrder(context, ORDER_ID)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === HTTP_NOT_FOUND &&
        readErrorCode(error) === 'ORDER_NOT_FOUND',
    );
  });

  it('maps invalid provider data to an internal error', async () => {
    const gateway = new StubGateway();
    gateway.listError = new MerchantOrderReadDataInvalidError();
    const service = new MerchantOrderReadService(gateway);

    await expect(service.listOrders(context, undefined, undefined)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === HTTP_INTERNAL_SERVER_ERROR &&
        readErrorCode(error) === 'INTERNAL_ERROR',
    );
  });

  it('maps provider outages to a retryable service error', async () => {
    const gateway = new StubGateway();
    gateway.listError = new MerchantOrderReadGatewayUnavailableError();
    const service = new MerchantOrderReadService(gateway);

    await expect(service.listOrders(context, undefined, undefined)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === HTTP_SERVICE_UNAVAILABLE &&
        readErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });
});
