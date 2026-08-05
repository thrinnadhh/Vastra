import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { MerchantOrderPackingActions } from './merchant-order-packing.screen';
import type {
  MerchantOrderDetail,
  MerchantOrderPackingPort,
  MerchantPackingList,
} from './merchant-order.types';

jest.mock('../barcode/merchant-barcode-scanner', () => ({
  MerchantBarcodeScanner: ({
    visible,
    onScanned,
  }: {
    readonly visible: boolean;
    readonly onScanned: (value: string) => void;
  }) =>
    visible ? (
      <Pressable
        accessibilityLabel="Emit test packing barcode"
        onPress={() => {
          onScanned('CORRECT-1');
        }}
      >
        <Text>Test scanner</Text>
      </Pressable>
    ) : null,
}));

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const ITEM_ID = '40000000-0000-4000-8000-000000000001';

function order(): MerchantOrderDetail {
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
    status: 'PACKING',
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
        previousStatus: 'MERCHANT_ACCEPTED',
        newStatus: 'PACKING',
        changedByRole: 'MERCHANT',
        reasonCode: null,
        note: null,
        createdAt: '2026-08-05T08:00:00.000Z',
      },
    ],
    placedAt: '2026-08-05T07:00:00.000Z',
    acceptedAt: '2026-08-05T07:05:00.000Z',
    readyAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-05T07:00:00.000Z',
    updatedAt: '2026-08-05T08:00:00.000Z',
  };
}

function packingList(verified: boolean): MerchantPackingList {
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
        verification: verified
          ? {
              method: 'BARCODE',
              result: 'MATCH',
              scannedBarcode: 'CORRECT-1',
              verifiedAt: '2026-08-05T08:05:00.000Z',
            }
          : null,
      },
    ],
  };
}

function port(): jest.Mocked<MerchantOrderPackingPort> {
  return {
    startPacking: jest.fn(() => Promise.reject(new Error('unused'))),
    getPackingList: jest
      .fn<
        ReturnType<MerchantOrderPackingPort['getPackingList']>,
        Parameters<MerchantOrderPackingPort['getPackingList']>
      >()
      .mockResolvedValueOnce(packingList(false))
      .mockResolvedValueOnce(packingList(true)),
    verifyPackingItem: jest.fn(() =>
      Promise.resolve({
        orderId: ORDER_ID,
        orderItemId: ITEM_ID,
        fulfilmentStatus: 'VERIFIED',
        method: 'BARCODE',
        result: 'MATCH',
        scannedBarcode: 'CORRECT-1',
        verified: true,
        verifiedAt: '2026-08-05T08:05:00.000Z',
        totalLines: 1,
        verifiedLines: 1,
        allVerified: true,
        replayed: false,
      }),
    ),
    markReadyForPickup: jest.fn(() => Promise.reject(new Error('unused'))),
  };
}

describe('merchant packing camera scanner', () => {
  it('passes the physical scan result directly to durable barcode verification', async () => {
    const packingClient = port();
    const view = render(
      <MerchantOrderPackingActions
        onOrderChanged={jest.fn()}
        order={order()}
        packingClient={packingClient}
      />,
    );

    await view.findByText('PENDING VERIFICATION');
    fireEvent.press(view.getByLabelText('Scan barcode for Kurta'));
    fireEvent.press(view.getByLabelText('Emit test packing barcode'));

    expect(await view.findByText('VERIFIED')).toBeTruthy();
    expect(packingClient.verifyPackingItem).toHaveBeenCalledWith(
      ORDER_ID,
      ITEM_ID,
      { method: 'BARCODE', barcode: 'CORRECT-1' },
    );
  });
});
