import { CaptainDeliveryApiError, HttpCaptainDeliveryClient } from './captain-delivery.client';

const DELIVERY = {
  taskId: '10000000-0000-4000-8000-000000000001',
  orderId: '20000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-S8-1',
  taskStatus: 'OFFERED',
  orderStatus: 'CAPTAIN_SEARCHING',
  assignmentId: '30000000-0000-4000-8000-000000000001',
  assignmentStatus: 'OFFERED',
  offeredEarningPaise: 4000,
  pickupDistanceMeters: 500,
  offeredAt: '2026-07-17T10:00:00.000Z',
  expiresAt: '2026-07-17T10:00:30.000Z',
  assignedAt: null,
  pickup: {
    label: 'Shop',
    recipientName: 'Test Shop',
    phoneNumber: '9000000000',
    line1: 'Main Road',
    line2: null,
    landmark: null,
    area: 'Tirupati',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    postalCode: '517501',
    countryCode: 'IN',
    location: { latitude: 13.628, longitude: 79.419 },
  },
  drop: {
    label: 'Home',
    recipientName: 'Customer',
    phoneNumber: '9000000001',
    line1: 'Renigunta Road',
    line2: null,
    landmark: null,
    area: 'Tirupati',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    postalCode: '517501',
    countryCode: 'IN',
    location: { latitude: 13.63, longitude: 79.42 },
  },
  totalPaise: 149900,
  paymentStatus: 'COD_PENDING',
  replayed: false,
};

function response(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

function requestHeaders(init: RequestInit | undefined): Headers {
  return new Headers(init?.headers);
}

describe('HttpCaptainDeliveryClient', () => {
  it('parses captain offers and sends bearer authentication', async () => {
    const calls: (readonly [string, RequestInit])[] = [];
    const client = new HttpCaptainDeliveryClient(
      'https://api.example.test/v1',
      () => Promise.resolve('token'),
      (input, init) => {
        calls.push([input, init]);
        return Promise.resolve(
          response({ success: true, data: { offers: [DELIVERY] }, meta: { requestId: null } }),
        );
      },
    );
    await expect(client.listOffers()).resolves.toHaveLength(1);
    expect(calls[0]?.[0]).toBe('https://api.example.test/v1/captain/delivery-offers');
    expect(requestHeaders(calls[0]?.[1]).get('Authorization')).toBe('Bearer token');
  });

  it('sends the idempotency key when accepting an offer', async () => {
    const calls: RequestInit[] = [];
    const client = new HttpCaptainDeliveryClient(
      'https://api.example.test/v1',
      () => Promise.resolve('token'),
      (_input, init) => {
        calls.push(init);
        return Promise.resolve(
          response({
            success: true,
            data: {
              delivery: {
                ...DELIVERY,
                taskStatus: 'ASSIGNED',
                orderStatus: 'CAPTAIN_ASSIGNED',
                assignmentStatus: 'ACCEPTED',
                assignedAt: '2026-07-17T10:00:00.000Z',
              },
            },
            meta: { requestId: null },
          }),
        );
      },
    );
    await client.acceptOffer(DELIVERY.assignmentId, '50000000-0000-4000-8000-000000000001');
    expect(requestHeaders(calls[0]).get('Idempotency-Key')).toBe(
      '50000000-0000-4000-8000-000000000001',
    );
  });

  it('sends exact COD and OTP completion without exposing them in the URL', async () => {
    const calls: (readonly [string, RequestInit])[] = [];
    const client = new HttpCaptainDeliveryClient(
      'https://api.example.test/v1',
      () => Promise.resolve('token'),
      (input, init) => {
        calls.push([input, init]);
        return Promise.resolve(
          response({
            success: true,
            data: {
              completion: {
                taskId: DELIVERY.taskId,
                orderId: DELIVERY.orderId,
                orderNumber: DELIVERY.orderNumber,
                taskStatus: 'COMPLETED',
                orderStatus: 'DELIVERED',
                paymentStatus: 'COD_COLLECTED',
                collectedAmountPaise: 149900,
                captainEarningPaise: 4000,
                completedAt: '2026-07-17T11:00:00.000Z',
                replayed: false,
              },
            },
            meta: { requestId: null },
          }),
        );
      },
    );
    await client.complete(
      DELIVERY.taskId,
      149900,
      '654321',
      null,
      '50000000-0000-4000-8000-000000000001',
    );
    expect(calls[0]?.[0]).toBe(
      `https://api.example.test/v1/captain/deliveries/${DELIVERY.taskId}/complete`,
    );
    expect(calls[0]?.[1].body).toBe(
      JSON.stringify({ collectedAmountPaise: 149900, deliveryOtp: '654321', location: null }),
    );
  });

  it('maps stable API errors', async () => {
    const client = new HttpCaptainDeliveryClient(
      'https://api.example.test/v1',
      () => Promise.resolve('token'),
      () =>
        Promise.resolve(
          response(
            {
              success: false,
              error: { code: 'DELIVERY_OTP_INVALID', message: 'Invalid OTP', retryable: false },
            },
            false,
          ),
        ),
    );
    await expect(client.listOffers()).rejects.toBeInstanceOf(CaptainDeliveryApiError);
  });
});
