import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MerchantOrderQueueScreen } from './merchant-order.screen';
import {
  MerchantOrderError,
  type MerchantOrderDecisionPort,
  type MerchantOrderDecisionResult,
  type MerchantOrderDetail,
  type MerchantOrderHistoryEntry,
  type MerchantOrderPackingPort,
  type MerchantOrderPage,
  type MerchantOrderReadPort,
  type MerchantOrderReadyResult,
  type MerchantOrderStartPackingResult,
  type MerchantOrderStatus,
  type MerchantOrderSummary,
  type MerchantPackingList,
  type MerchantPackingVerificationInput,
  type MerchantPackingVerificationResult,
  type MerchantRejectionReason,
} from './merchant-order.types';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const ITEM_ID = '20000000-0000-4000-8000-000000000001';
const SHOP_ID = '30000000-0000-4000-8000-000000000001';
const NOW = '2026-07-17T03:00:00.000Z';

class AuthoritativeMerchantJourney
  implements MerchantOrderReadPort, MerchantOrderDecisionPort, MerchantOrderPackingPort
{
  public status: MerchantOrderStatus = 'WAITING_FOR_MERCHANT';
  public verification: 'NONE' | 'MISMATCH' | 'VERIFIED' = 'NONE';
  public readonly acceptPayloads: number[] = [];
  public readonly readyKeys: string[] = [];
  public getOrderCalls = 0;

  private preparationMinutes: number | null = null;
  private acceptedResponseLost = false;
  private readyResponseLost = false;
  private acceptedAt: string | null = null;
  private readyAt: string | null = null;
  private readonly history: MerchantOrderHistoryEntry[] = [
    {
      id: '1',
      previousStatus: null,
      newStatus: 'WAITING_FOR_MERCHANT',
      changedByRole: 'SYSTEM',
      reasonCode: null,
      note: null,
      createdAt: NOW,
    },
  ];

  public listOrders(): Promise<MerchantOrderPage> {
    return Promise.resolve({ orders: [this.summary()], nextCursor: null });
  }

  public getOrder(): Promise<MerchantOrderDetail> {
    this.getOrderCalls += 1;
    return Promise.resolve(this.detail());
  }

  public acceptOrder(
    orderId: string,
    input: { readonly preparationMinutes: number },
  ): Promise<MerchantOrderDecisionResult> {
    this.requireOrder(orderId);
    this.acceptPayloads.push(input.preparationMinutes);

    if (this.status === 'WAITING_FOR_MERCHANT') {
      this.preparationMinutes = input.preparationMinutes;
      this.acceptedAt = '2026-07-17T03:01:00.000Z';
      this.transition('MERCHANT_ACCEPTED', this.acceptedAt);
      this.acceptedResponseLost = true;
      return Promise.reject(new MerchantOrderError('TRANSPORT', null, true));
    }

    if (
      this.status === 'MERCHANT_ACCEPTED' &&
      this.acceptedResponseLost &&
      this.preparationMinutes === input.preparationMinutes
    ) {
      return Promise.resolve(this.decisionResult(true));
    }

    return Promise.reject(
      new MerchantOrderError('INVALID_STATE', 'MERCHANT_ORDER_INVALID_STATE', false),
    );
  }

  public rejectOrder(
    orderId: string,
    _input: {
      readonly reasonCode: MerchantRejectionReason;
      readonly orderItemId: string | null;
      readonly note: string | null;
    },
  ): Promise<MerchantOrderDecisionResult> {
    this.requireOrder(orderId);
    void _input;
    return Promise.reject(
      new MerchantOrderError('INVALID_STATE', 'MERCHANT_ORDER_INVALID_STATE', false),
    );
  }

  public startPacking(orderId: string): Promise<MerchantOrderStartPackingResult> {
    this.requireOrder(orderId);
    if (this.status === 'MERCHANT_ACCEPTED') {
      this.transition('PACKING', '2026-07-17T03:02:00.000Z');
      return Promise.resolve({
        orderId,
        orderNumber: 'VAS-JOURNEY',
        status: 'PACKING',
        replayed: false,
      });
    }
    if (this.status === 'PACKING') {
      return Promise.resolve({
        orderId,
        orderNumber: 'VAS-JOURNEY',
        status: 'PACKING',
        replayed: true,
      });
    }
    return Promise.reject(
      new MerchantOrderError('INVALID_STATE', 'MERCHANT_ORDER_PACKING_INVALID_STATE', false),
    );
  }

  public getPackingList(orderId: string): Promise<MerchantPackingList> {
    this.requireOrder(orderId);
    if (this.status !== 'PACKING') {
      return Promise.reject(
        new MerchantOrderError('INVALID_STATE', 'MERCHANT_ORDER_PACKING_INVALID_STATE', false),
      );
    }
    const verified = this.verification === 'VERIFIED';
    return Promise.resolve({
      orderId,
      orderNumber: 'VAS-JOURNEY',
      status: 'PACKING',
      totalLines: 1,
      verifiedLines: verified ? 1 : 0,
      allVerified: verified,
      items: [
        {
          orderItemId: ITEM_ID,
          productName: 'Journey Kurta',
          sku: 'JOURNEY-K-M',
          colour: 'Blue',
          size: 'M',
          imageObjectKey: null,
          quantity: 1,
          fulfilmentStatus: verified ? 'VERIFIED' : 'PENDING',
          verification:
            this.verification === 'NONE'
              ? null
              : {
                  method: this.verification === 'MISMATCH' ? 'BARCODE' : 'MANUAL',
                  result: this.verification === 'MISMATCH' ? 'MISMATCH' : 'MATCH',
                  scannedBarcode: this.verification === 'MISMATCH' ? 'WRONG-BARCODE' : null,
                  verifiedAt: '2026-07-17T03:03:00.000Z',
                },
        },
      ],
    });
  }

  public verifyPackingItem(
    orderId: string,
    orderItemId: string,
    input: MerchantPackingVerificationInput,
  ): Promise<MerchantPackingVerificationResult> {
    this.requireOrder(orderId);
    if (orderItemId !== ITEM_ID || this.status !== 'PACKING') {
      return Promise.reject(new MerchantOrderError('NOT_FOUND', 'PACKING_ITEM_NOT_FOUND', false));
    }
    const matches = input.method === 'MANUAL' || input.barcode === 'JOURNEY-K-M';
    this.verification = matches ? 'VERIFIED' : 'MISMATCH';
    return Promise.resolve({
      orderId,
      orderItemId,
      fulfilmentStatus: matches ? 'VERIFIED' : 'PENDING',
      method: input.method,
      result: matches ? 'MATCH' : 'MISMATCH',
      scannedBarcode: input.method === 'BARCODE' ? input.barcode : null,
      verified: matches,
      verifiedAt: '2026-07-17T03:03:00.000Z',
      totalLines: 1,
      verifiedLines: matches ? 1 : 0,
      allVerified: matches,
      replayed: false,
    });
  }

  public markReadyForPickup(
    orderId: string,
    idempotencyKey: string,
  ): Promise<MerchantOrderReadyResult> {
    this.requireOrder(orderId);
    this.readyKeys.push(idempotencyKey);

    if (this.status === 'PACKING' && this.verification === 'VERIFIED') {
      this.readyAt = '2026-07-17T03:04:00.000Z';
      this.transition('READY_FOR_PICKUP', this.readyAt);
      this.readyResponseLost = true;
      return Promise.reject(new MerchantOrderError('TRANSPORT', null, true));
    }

    if (
      this.status === 'READY_FOR_PICKUP' &&
      this.readyResponseLost &&
      this.readyKeys[0] === idempotencyKey
    ) {
      return Promise.resolve(this.readyResult(true));
    }

    return Promise.reject(
      new MerchantOrderError('INVALID_STATE', 'MERCHANT_ORDER_READY_INVALID_STATE', false),
    );
  }

  public historyStatuses(): readonly MerchantOrderStatus[] {
    return this.history.map((entry) => entry.newStatus);
  }

  private summary(): MerchantOrderSummary {
    return {
      id: ORDER_ID,
      orderNumber: 'VAS-JOURNEY',
      shop: { id: SHOP_ID, name: 'Journey Shop', slug: 'journey-shop' },
      customerName: 'Asha',
      status: this.status,
      paymentStatus: 'COD_PENDING',
      fulfilmentType: 'DELIVERY',
      itemCount: 1,
      previewImageObjectKey: null,
      totals: {
        subtotalPaise: 50_000,
        productDiscountPaise: 0,
        couponDiscountPaise: 0,
        deliveryFeePaise: 4_000,
        platformFeePaise: 500,
        taxPaise: 0,
        totalPaise: 54_500,
      },
      alert: null,
      estimatedDeliveryAt: null,
      placedAt: NOW,
      createdAt: NOW,
    };
  }

  private detail(): MerchantOrderDetail {
    const summary = this.summary();
    return {
      id: summary.id,
      orderNumber: summary.orderNumber,
      cartId: null,
      quoteId: null,
      shop: summary.shop,
      address: {
        id: '40000000-0000-4000-8000-000000000001',
        label: 'Home',
        recipientName: 'Asha',
        phoneNumber: '9000000000',
        line1: 'Temple Road',
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
      status: summary.status,
      paymentStatus: summary.paymentStatus,
      fulfilmentType: summary.fulfilmentType,
      items: [
        {
          id: ITEM_ID,
          productId: '50000000-0000-4000-8000-000000000001',
          variantId: '60000000-0000-4000-8000-000000000001',
          productName: 'Journey Kurta',
          sku: 'JOURNEY-K-M',
          colourName: 'Blue',
          sizeLabel: 'M',
          imageObjectKey: null,
          quantity: 1,
          unitMrpPaise: 50_000,
          unitSellingPricePaise: 50_000,
          discountPaise: 0,
          totalPaise: 50_000,
        },
      ],
      itemCount: summary.itemCount,
      previewImageObjectKey: null,
      totals: summary.totals,
      alert: null,
      estimatedDeliveryAt: null,
      customerNote: null,
      cancellationReasonCode: null,
      cancellationNote: null,
      history: [...this.history],
      placedAt: NOW,
      acceptedAt: this.acceptedAt,
      readyAt: this.readyAt,
      pickedUpAt: null,
      deliveredAt: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: NOW,
      updatedAt: this.history.at(-1)?.createdAt ?? NOW,
    };
  }

  private transition(nextStatus: MerchantOrderStatus, at: string): void {
    const previousStatus = this.status;
    this.status = nextStatus;
    this.history.push({
      id: String(this.history.length + 1),
      previousStatus,
      newStatus: nextStatus,
      changedByRole: 'MERCHANT',
      reasonCode: null,
      note: null,
      createdAt: at,
    });
  }

  private decisionResult(replayed: boolean): MerchantOrderDecisionResult {
    return {
      orderId: ORDER_ID,
      orderNumber: 'VAS-JOURNEY',
      status: 'MERCHANT_ACCEPTED',
      alertStatus: 'ACKNOWLEDGED',
      merchantPreparationMinutes: this.preparationMinutes,
      acceptedAt: this.acceptedAt,
      cancelledAt: null,
      cancellationReasonCode: null,
      cancellationNote: null,
      reservationsReleased: 0,
      replayed,
    };
  }

  private readyResult(replayed: boolean): MerchantOrderReadyResult {
    if (this.readyAt === null) throw new TypeError('Ready timestamp is unavailable');
    return {
      orderId: ORDER_ID,
      orderNumber: 'VAS-JOURNEY',
      status: 'READY_FOR_PICKUP',
      readyAt: this.readyAt,
      totalLines: 1,
      packedLines: 1,
      allPacked: true,
      replayed,
    };
  }

  private requireOrder(orderId: string): void {
    if (orderId !== ORDER_ID) {
      throw new MerchantOrderError('NOT_FOUND', 'MERCHANT_ORDER_NOT_FOUND', false);
    }
  }
}

describe('merchant COD fulfilment journey', () => {
  it('uses authoritative reads and safe replays through READY_FOR_PICKUP', async () => {
    const backend = new AuthoritativeMerchantJourney();
    const view = render(
      <MerchantOrderQueueScreen
        decisionClient={backend}
        orderClient={backend}
        packingClient={backend}
        pollIntervalMs={0}
      />,
    );

    await view.findByText('VAS-JOURNEY');
    fireEvent.press(view.getByLabelText('Open order VAS-JOURNEY for Asha'));
    await view.findByText('Customer and delivery');

    fireEvent.press(view.getByLabelText('Accept complete merchant order'));
    fireEvent.changeText(view.getByLabelText('Merchant preparation time in minutes'), '35');
    fireEvent.press(view.getByLabelText('Confirm merchant order acceptance'));
    await view.findByText('You appear to be offline. Retry the same decision after reconnecting.');

    expect(backend.acceptPayloads).toEqual([35]);
    expect(backend.historyStatuses()).toEqual(['WAITING_FOR_MERCHANT', 'MERCHANT_ACCEPTED']);

    fireEvent.press(view.getByLabelText('Retry same merchant order decision'));
    await view.findByText('Decision is no longer pending');
    expect(backend.acceptPayloads).toEqual([35, 35]);
    expect(backend.historyStatuses()).toEqual(['WAITING_FOR_MERCHANT', 'MERCHANT_ACCEPTED']);

    fireEvent.press(view.getByLabelText('Start packing merchant order'));
    await view.findByText('PENDING VERIFICATION');
    expect(backend.historyStatuses()).toEqual([
      'WAITING_FOR_MERCHANT',
      'MERCHANT_ACCEPTED',
      'PACKING',
    ]);

    fireEvent.changeText(view.getByLabelText('Barcode for Journey Kurta'), 'WRONG-BARCODE');
    fireEvent.press(view.getByLabelText('Verify Journey Kurta by barcode'));
    await view.findByText('BARCODE MISMATCH');
    expect(backend.verification).toBe('MISMATCH');
    expect(view.getByLabelText('Mark merchant order ready for pickup')).toBeDisabled();
    expect(backend.historyStatuses()).toEqual([
      'WAITING_FOR_MERCHANT',
      'MERCHANT_ACCEPTED',
      'PACKING',
    ]);

    fireEvent.press(view.getByLabelText('Manually confirm Journey Kurta'));
    await view.findByText('VERIFIED');
    expect(backend.verification).toBe('VERIFIED');
    expect(view.getByLabelText('Mark merchant order ready for pickup')).toBeEnabled();

    fireEvent.press(view.getByLabelText('Mark merchant order ready for pickup'));
    await view.findByText(
      'You appear to be offline. Reconnect and retry without losing checklist progress.',
    );
    expect(backend.readyKeys).toHaveLength(1);
    expect(backend.historyStatuses()).toEqual([
      'WAITING_FOR_MERCHANT',
      'MERCHANT_ACCEPTED',
      'PACKING',
      'READY_FOR_PICKUP',
    ]);

    fireEvent.press(view.getByLabelText('Retry ready for pickup with same idempotency key'));
    await view.findByLabelText('Packing complete. Order ready for pickup');
    expect(backend.readyKeys).toHaveLength(2);
    expect(backend.readyKeys[1]).toBe(backend.readyKeys[0]);
    expect(backend.status).toBe('READY_FOR_PICKUP');
    expect(backend.getOrderCalls).toBeGreaterThanOrEqual(4);
    expect(backend.historyStatuses()).toEqual([
      'WAITING_FOR_MERCHANT',
      'MERCHANT_ACCEPTED',
      'PACKING',
      'READY_FOR_PICKUP',
    ]);

    expect(view.queryByText(/assign captain/iu)).toBeNull();
    expect(view.queryByText(/pickup code/iu)).toBeNull();
    await waitFor(() => {
      expect(view.getByText('READY FOR PICKUP')).toBeTruthy();
    });
  });
});
