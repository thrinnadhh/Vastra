import type { ApiClient } from '@vastra/api-client';

import { ApiCustomerOrderAdapter } from './api-customer-order.adapter';
import type { CustomerOrderError } from './customer-order.types';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';
const SHOP_ID = '30000000-0000-4000-8000-000000000001';
const ITEM_ID = '40000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '50000000-0000-4000-8000-000000000001';
const VARIANT_ID = '60000000-0000-4000-8000-000000000001';

const totals = {
  subtotalPaise: 10000,
  productDiscountPaise: 0,
  couponDiscountPaise: 0,
  deliveryFeePaise: 0,
  platformFeePaise: 0,
  taxPaise: 0,
  totalPaise: 10000,
};
const address = {
  id: ADDRESS_ID,
  label: 'Home',
  recipientName: 'Customer',
  phoneNumber: '9000000000',
  line1: 'Road',
  line2: null,
  landmark: null,
  area: 'Tirupati',
  city: 'Tirupati',
  state: 'Andhra Pradesh',
  postalCode: '517501',
  countryCode: 'IN',
  latitude: 13.6,
  longitude: 79.4,
};
const item = {
  id: ITEM_ID,
  productId: PRODUCT_ID,
  variantId: VARIANT_ID,
  productName: 'Kurta',
  sku: 'K-M',
  colourName: null,
  sizeLabel: 'M',
  imageObjectKey: null,
  quantity: 1,
  unitMrpPaise: 10000,
  unitSellingPricePaise: 10000,
  discountPaise: 0,
  totalPaise: 10000,
};

function clientReturning(payload: unknown): { client: ApiClient; request: jest.Mock } {
  const request = jest.fn().mockResolvedValue({ data: payload, status: 200, requestId: 'req' });
  return { client: { request }, request };
}

describe('ApiCustomerOrderAdapter', () => {
  it('uses generated order operations and strips internal history data', async () => {
    const payload = {
      success: true,
      data: {
        order: {
          id: ORDER_ID,
          orderNumber: 'VAS-1',
          cartId: null,
          quoteId: null,
          shop: { id: SHOP_ID, name: 'Shop', slug: 'shop' },
          address,
          status: 'WAITING_FOR_MERCHANT',
          paymentStatus: 'COD_PENDING',
          fulfilmentType: 'DELIVERY',
          items: [item],
          itemCount: 1,
          totals,
          estimatedDeliveryAt: null,
          customerNote: null,
          cancellationReasonCode: 'INTERNAL_RISK_CODE',
          cancellationNote: 'private admin note',
          history: [
            {
              id: '1',
              previousStatus: null,
              newStatus: 'WAITING_FOR_MERCHANT',
              changedByRole: 'ADMIN',
              reasonCode: 'INTERNAL_REASON',
              note: 'private operational note',
              createdAt: '2026-07-20T10:00:00.000Z',
            },
          ],
          placedAt: '2026-07-20T10:00:00.000Z',
          acceptedAt: null,
          readyAt: null,
          pickedUpAt: null,
          deliveredAt: null,
          completedAt: null,
          cancelledAt: null,
          createdAt: '2026-07-20T10:00:00.000Z',
          updatedAt: '2026-07-20T10:00:00.000Z',
        },
      },
    };
    const { client, request } = clientReturning(payload);
    const order = await new ApiCustomerOrderAdapter(client).getOrder(ORDER_ID);

    expect(request).toHaveBeenCalledWith('getCustomerOrder', { path: { orderId: ORDER_ID } });
    expect(order.history).toEqual([
      { id: '1', status: 'WAITING_FOR_MERCHANT', createdAt: '2026-07-20T10:00:00.000Z' },
    ]);
    expect(order).not.toHaveProperty('cancellationReasonCode');
    expect(order).not.toHaveProperty('cancellationNote');
    expect(JSON.stringify(order)).not.toContain('private');
    expect(JSON.stringify(order)).not.toContain('INTERNAL_');
  });

  it('maps an unknown order status without exposing the backend enum', async () => {
    const { client } = clientReturning({
      success: true,
      data: {
        orders: [
          {
            id: ORDER_ID,
            orderNumber: 'VAS-2',
            shop: { id: SHOP_ID, name: 'Shop', slug: 'shop' },
            status: 'INTERNAL_NEW_STATE',
            paymentStatus: 'COD_PENDING',
            fulfilmentType: 'DELIVERY',
            itemCount: 1,
            previewImageObjectKey: null,
            totals,
            estimatedDeliveryAt: null,
            placedAt: null,
            createdAt: '2026-07-20T10:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
    });
    const page = await new ApiCustomerOrderAdapter(client).listOrders();
    expect(page.orders[0]?.status).toBe('UNKNOWN');
  });

  it('maps tracking and OTP only when the response belongs to the requested order', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            tracking: {
              orderId: ORDER_ID,
              deliveryTaskId: '70000000-0000-4000-8000-000000000001',
              orderNumber: 'VAS-1',
              orderStatus: 'OUT_FOR_DELIVERY',
              taskStatus: 'IN_TRANSIT',
              captain: null,
              location: null,
              estimatedArrivalAt: null,
              updatedAt: '2026-07-22T10:00:00.000Z',
            },
          },
          meta: { requestId: null },
        },
        status: 200,
        requestId: 'req',
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            secret: {
              orderId: ORDER_ID,
              deliveryTaskId: '70000000-0000-4000-8000-000000000001',
              kind: 'DELIVERY_OTP',
              secret: '123456',
              issuedAt: '2026-07-22T10:00:00.000Z',
              expiresAt: '2026-07-22T10:05:00.000Z',
            },
          },
          meta: { requestId: null },
        },
        status: 200,
        requestId: 'req',
      });
    const adapter = new ApiCustomerOrderAdapter({ request } as ApiClient);

    await expect(adapter.getTracking(ORDER_ID)).resolves.toMatchObject({ orderId: ORDER_ID });
    await expect(adapter.getDeliveryOtp(ORDER_ID)).resolves.toMatchObject({
      orderId: ORDER_ID,
      secret: '123456',
    });
  });

  it('rejects a tracking response scoped to a different order', async () => {
    const { client } = clientReturning({
      success: true,
      data: {
        tracking: {
          orderId: '10000000-0000-4000-8000-000000000099',
          deliveryTaskId: '70000000-0000-4000-8000-000000000001',
          orderNumber: 'VAS-WRONG',
          orderStatus: 'OUT_FOR_DELIVERY',
          taskStatus: 'IN_TRANSIT',
          captain: null,
          location: null,
          estimatedArrivalAt: null,
          updatedAt: '2026-07-22T10:00:00.000Z',
        },
      },
      meta: { requestId: null },
    });

    await expect(new ApiCustomerOrderAdapter(client).getTracking(ORDER_ID)).rejects.toMatchObject({
      kind: 'MALFORMED_RESPONSE',
    } satisfies Partial<CustomerOrderError>);
  });

  it('rejects a delivery OTP response scoped to a different order', async () => {
    const { client } = clientReturning({
      success: true,
      data: {
        secret: {
          orderId: '10000000-0000-4000-8000-000000000099',
          deliveryTaskId: '70000000-0000-4000-8000-000000000001',
          kind: 'DELIVERY_OTP',
          secret: '123456',
          issuedAt: '2026-07-22T10:00:00.000Z',
          expiresAt: '2026-07-22T10:05:00.000Z',
        },
      },
      meta: { requestId: null },
    });

    await expect(
      new ApiCustomerOrderAdapter(client).getDeliveryOtp(ORDER_ID),
    ).rejects.toMatchObject({
      kind: 'MALFORMED_RESPONSE',
    } satisfies Partial<CustomerOrderError>);
  });
});
