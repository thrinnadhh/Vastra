import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { MerchantOrderPackingActions } from './merchant-order-packing.screen';
import {
  MerchantOrderError,
  type MerchantOrderDetail,
  type MerchantOrderPackingPort,
  type MerchantOrderStartPackingResult,
  type MerchantPackingList,
} from './merchant-order.types';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const ITEM_ID = '40000000-0000-4000-8000-000000000001';
const READY_KEY = 'a0000000-0000-4000-8000-000000000001';

function order(status: MerchantOrderDetail['status']): MerchantOrderDetail {
  return {
    id: ORDER_ID,
    orderNumber: 'VAS-1',
    cartId: null,
    quoteId: null,
    shop: { id: '20000000-0000-4000-8000-000000000001', name: 'Shop', slug: 'shop' },
    address: {
      id: '30000000-0000-4000-8000-000000000001',
      label: null,
      recipientName: 'Asha',
      phoneNumber: '9000000000',
      line1: 'Road',
      line2: null,
      landmark: null,
      area: 'Tirupati',
      city: 'Tirupati',
      state: 'AP',
      postalCode: '517501',
      countryCode: 'IN',
      latitude: 13,
      longitude: 79,
    },
    status,
    paymentStatus: 'COD_PENDING',
    fulfilmentType: 'DELIVERY',
    items: [
      {
        id: ITEM_ID,
        productId: '50000000-0000-4000-8000-000000000001',
        variantId: '60000000-0000-4000-8000-000000000001',
        productName: 'Kurta',
        sku: 'K-M',
        colourName: 'Blue',
        sizeLabel: 'M',
        imageObjectKey: null,
        quantity: 1,
        unitMrpPaise: 10000,
        unitSellingPricePaise: 10000,
        discountPaise: 0,
        totalPaise: 10000,
      },
    ],
    itemCount: 1,
    previewImageObjectKey: null,
    totals: {
      subtotalPaise: 10000,
      productDiscountPaise: 0,
      couponDiscountPaise: 0,
      deliveryFeePaise: 0,
      platformFeePaise: 0,
      taxPaise: 0,
      totalPaise: 10000,
    },
    alert: null,
    estimatedDeliveryAt: null,
    customerNote: null,
    cancellationReasonCode: null,
    cancellationNote: null,
    history: [
      {
        id: '1',
        previousStatus: null,
        newStatus: 'WAITING_FOR_MERCHANT',
        changedByRole: 'SYSTEM',
        reasonCode: null,
        note: null,
        createdAt: '2026-07-17T01:00:00.000Z',
      },
    ],
    placedAt: '2026-07-17T01:00:00.000Z',
    acceptedAt: null,
    readyAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: '2026-07-17T01:00:00.000Z',
    updatedAt: '2026-07-17T01:00:00.000Z',
  };
}

function list(kind: 'PENDING' | 'MISMATCH' | 'VERIFIED'): MerchantPackingList {
  const verified = kind === 'VERIFIED';
  return {
    orderId: ORDER_ID,
    orderNumber: 'VAS-1',
    status: 'PACKING',
    totalLines: 1,
    verifiedLines: verified ? 1 : 0,
    allVerified: verified,
    items: [
      {
        orderItemId: ITEM_ID,
        productName: 'Kurta',
        sku: 'K-M',
        colour: 'Blue',
        size: 'M',
        imageObjectKey: null,
        quantity: 1,
        fulfilmentStatus: verified ? 'VERIFIED' : 'PENDING',
        verification:
          kind === 'PENDING'
            ? null
            : {
                method: kind === 'MISMATCH' ? 'BARCODE' : 'MANUAL',
                result: kind === 'MISMATCH' ? 'MISMATCH' : 'MATCH',
                scannedBarcode: kind === 'MISMATCH' ? 'WRONG' : null,
                verifiedAt: '2026-07-17T02:00:00.000Z',
              },
      },
    ],
  };
}

function packingPort(): jest.Mocked<MerchantOrderPackingPort> {
  return {
    startPacking: jest.fn<
      ReturnType<MerchantOrderPackingPort['startPacking']>,
      Parameters<MerchantOrderPackingPort['startPacking']>
    >(() =>
      Promise.resolve({
        orderId: ORDER_ID,
        orderNumber: 'VAS-1',
        status: 'PACKING',
        replayed: false,
      }),
    ),
    getPackingList: jest.fn<
      ReturnType<MerchantOrderPackingPort['getPackingList']>,
      Parameters<MerchantOrderPackingPort['getPackingList']>
    >(() => Promise.resolve(list('PENDING'))),
    verifyPackingItem: jest.fn<
      ReturnType<MerchantOrderPackingPort['verifyPackingItem']>,
      Parameters<MerchantOrderPackingPort['verifyPackingItem']>
    >(() =>
      Promise.resolve({
        orderId: ORDER_ID,
        orderItemId: ITEM_ID,
        fulfilmentStatus: 'VERIFIED',
        method: 'MANUAL',
        result: 'MATCH',
        scannedBarcode: null,
        verified: true,
        verifiedAt: '2026-07-17T02:00:00.000Z',
        totalLines: 1,
        verifiedLines: 1,
        allVerified: true,
        replayed: false,
      }),
    ),
    markReadyForPickup: jest.fn<
      ReturnType<MerchantOrderPackingPort['markReadyForPickup']>,
      Parameters<MerchantOrderPackingPort['markReadyForPickup']>
    >(() =>
      Promise.resolve({
        orderId: ORDER_ID,
        orderNumber: 'VAS-1',
        status: 'READY_FOR_PICKUP',
        readyAt: '2026-07-17T02:10:00.000Z',
        totalLines: 1,
        packedLines: 1,
        allPacked: true,
        replayed: false,
      }),
    ),
  };
}

describe('MerchantOrderPackingActions', () => {
  it('starts packing idempotently and blocks duplicate taps', async () => {
    let resolveStart: ((value: MerchantOrderStartPackingResult) => void) | undefined;
    const client = packingPort();
    client.startPacking.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStart = resolve;
        }),
    );
    const onChanged = jest.fn();
    const view = render(
      <MerchantOrderPackingActions
        createIdempotencyKey={() => READY_KEY}
        onOrderChanged={onChanged}
        order={order('MERCHANT_ACCEPTED')}
        packingClient={client}
      />,
    );
    fireEvent.press(view.getByLabelText('Start packing merchant order'));
    fireEvent.press(view.getByLabelText('Start packing merchant order'));
    expect(client.startPacking.mock.calls).toEqual([[ORDER_ID]]);
    await act(async () => {
      resolveStart?.({
        orderId: ORDER_ID,
        orderNumber: 'VAS-1',
        status: 'PACKING',
        replayed: false,
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(client.getPackingList.mock.calls).toHaveLength(1);
    });
    expect(onChanged.mock.calls).toHaveLength(1);
  });

  it('loads durable progress and blocks ready while verification is incomplete', async () => {
    const client = packingPort();
    const view = render(
      <MerchantOrderPackingActions
        createIdempotencyKey={() => READY_KEY}
        onOrderChanged={jest.fn()}
        order={order('PACKING')}
        packingClient={client}
      />,
    );
    expect(await view.findByText('0 of 1 verified')).toBeTruthy();
    expect(view.getByText('Verification incomplete')).toBeTruthy();
    expect(view.getByLabelText('Mark merchant order ready for pickup')).toBeDisabled();
  });

  it('supports manual verification and refreshes the authoritative checklist', async () => {
    const client = packingPort();
    client.getPackingList
      .mockResolvedValueOnce(list('PENDING'))
      .mockResolvedValueOnce(list('VERIFIED'));
    const view = render(
      <MerchantOrderPackingActions
        createIdempotencyKey={() => READY_KEY}
        onOrderChanged={jest.fn()}
        order={order('PACKING')}
        packingClient={client}
      />,
    );
    await view.findByText('PENDING VERIFICATION');
    fireEvent.press(view.getByLabelText('Manually confirm Kurta'));
    expect(await view.findByText('VERIFIED')).toBeTruthy();
    expect(client.verifyPackingItem.mock.calls).toEqual([
      [ORDER_ID, ITEM_ID, { method: 'MANUAL' }],
    ]);
  });

  it('shows a barcode mismatch without falsely completing verification', async () => {
    const client = packingPort();
    client.verifyPackingItem.mockResolvedValue({
      orderId: ORDER_ID,
      orderItemId: ITEM_ID,
      fulfilmentStatus: 'PENDING',
      method: 'BARCODE',
      result: 'MISMATCH',
      scannedBarcode: 'WRONG',
      verified: false,
      verifiedAt: '2026-07-17T02:00:00.000Z',
      totalLines: 1,
      verifiedLines: 0,
      allVerified: false,
      replayed: false,
    });
    client.getPackingList
      .mockResolvedValueOnce(list('PENDING'))
      .mockResolvedValueOnce(list('MISMATCH'));
    const view = render(
      <MerchantOrderPackingActions
        createIdempotencyKey={() => READY_KEY}
        onOrderChanged={jest.fn()}
        order={order('PACKING')}
        packingClient={client}
      />,
    );
    await view.findByText('PENDING VERIFICATION');
    fireEvent.changeText(view.getByLabelText('Barcode for Kurta'), 'WRONG');
    fireEvent.press(view.getByLabelText('Verify Kurta by barcode'));
    expect(await view.findByText('BARCODE MISMATCH')).toBeTruthy();
    expect(view.getByText(/did not match this ordered variant/u)).toBeTruthy();
    expect(view.getByLabelText('Mark merchant order ready for pickup')).toBeDisabled();
  });

  it('reuses one ready idempotency key across an offline retry and blocks duplicate taps', async () => {
    const client = packingPort();
    client.getPackingList.mockResolvedValue(list('VERIFIED'));
    client.markReadyForPickup
      .mockRejectedValueOnce(new MerchantOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce({
        orderId: ORDER_ID,
        orderNumber: 'VAS-1',
        status: 'READY_FOR_PICKUP',
        readyAt: '2026-07-17T02:10:00.000Z',
        totalLines: 1,
        packedLines: 1,
        allPacked: true,
        replayed: true,
      });
    const onChanged = jest.fn();
    const view = render(
      <MerchantOrderPackingActions
        createIdempotencyKey={() => READY_KEY}
        onOrderChanged={onChanged}
        order={order('PACKING')}
        packingClient={client}
      />,
    );
    await view.findByText('1 of 1 verified');
    fireEvent.press(view.getByLabelText('Mark merchant order ready for pickup'));
    expect(await view.findByText(/appear to be offline/u)).toBeTruthy();
    fireEvent.press(view.getByLabelText('Retry ready for pickup with same idempotency key'));
    await waitFor(() => {
      expect(onChanged.mock.calls).toHaveLength(1);
    });
    expect(client.markReadyForPickup.mock.calls).toEqual([
      [ORDER_ID, READY_KEY],
      [ORDER_ID, READY_KEY],
    ]);
  });

  it('ends at READY_FOR_PICKUP without captain simulation', () => {
    const view = render(
      <MerchantOrderPackingActions
        createIdempotencyKey={() => READY_KEY}
        onOrderChanged={jest.fn()}
        order={order('READY_FOR_PICKUP')}
        packingClient={packingPort()}
      />,
    );
    expect(view.getByText('Ready for pickup')).toBeTruthy();
    expect(view.queryByText(/assign captain/iu)).toBeNull();
    expect(view.queryByText(/pickup code/iu)).toBeNull();
  });
});
