import type { ApiClient, OperationResponse } from '@vastra/api-client';

import {
  parseCustomerOrderDetailEnvelope,
  parseCustomerOrdersPageEnvelope,
} from './customer-order.codec';
import {
  CustomerOrderError,
  type CustomerOrderDetail,
  type CustomerOrderFailureKind,
  type CustomerOrderReadPort,
  type CustomerOrdersPage,
  type ListCustomerOrdersInput,
} from './customer-order.types';
import type {
  CustomerDeliveryOtp,
  CustomerOrderTrackingPort,
  CustomerOrderTrackingSnapshot,
} from './customer-order-tracking.types';

type ListOrdersResponse = OperationResponse<'listCustomerOrders'>;
type GetOrderResponse = OperationResponse<'getCustomerOrder'>;
type TrackingResponse = OperationResponse<'getCustomerOrderTracking'>;
type DeliveryOtpResponse = OperationResponse<'getCustomerDeliveryOtp'>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function field(record: Readonly<Record<string, unknown>>, key: string): unknown {
  return record[key];
}

function mapApiFailure(error: unknown): CustomerOrderError {
  const normalized = isRecord(error) && isRecord(error['normalized']) ? error['normalized'] : null;
  if (normalized === null) {
    return new CustomerOrderError('UNKNOWN', null, false);
  }
  let kind: CustomerOrderFailureKind = 'UNKNOWN';
  switch (normalized['kind']) {
    case 'AUTHENTICATION':
      kind = 'AUTHENTICATION';
      break;
    case 'AUTHORIZATION':
      kind = 'FORBIDDEN';
      break;
    case 'VALIDATION':
      kind = 'VALIDATION';
      break;
    case 'NOT_FOUND':
      kind = 'NOT_FOUND';
      break;
    case 'CONFLICT':
      kind = 'CONFLICT';
      break;
    case 'TRANSPORT':
    case 'TIMEOUT':
      kind = 'TRANSPORT';
      break;
    case 'CONTRACT':
      kind = 'MALFORMED_RESPONSE';
      break;
    case 'RATE_LIMIT':
    case 'API':
      kind = normalized['status'] === 503 ? 'TEMPORARILY_UNAVAILABLE' : 'UNKNOWN';
      break;
    case 'UNKNOWN':
      kind = 'UNKNOWN';
      break;
  }
  return new CustomerOrderError(
    kind,
    typeof normalized['code'] === 'string' ? normalized['code'] : null,
    normalized['retryable'] === true,
  );
}

function stringValue(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
  }
  return value;
}

function nullableString(record: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
  }
  return value;
}

function parseTrackingEnvelope(value: TrackingResponse): CustomerOrderTrackingSnapshot {
  const envelope: unknown = value;
  if (
    !isRecord(envelope) ||
    field(envelope, 'success') !== true ||
    !isRecord(field(envelope, 'data'))
  ) {
    throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
  }
  const data = field(envelope, 'data');
  if (!isRecord(data)) {
    throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
  }
  const tracking = field(data, 'tracking');
  if (!isRecord(tracking)) {
    throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
  }
  const captainValue = tracking['captain'];
  const locationValue = tracking['location'];
  const captain =
    captainValue === null
      ? null
      : isRecord(captainValue)
        ? {
            displayName: nullableString(captainValue, 'displayName'),
            phoneLast4: nullableString(captainValue, 'phoneLast4'),
            vehicleType: nullableString(captainValue, 'vehicleType'),
            vehicleNumberLast4: nullableString(captainValue, 'vehicleNumberLast4'),
          }
        : (() => {
            throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
          })();
  const location =
    locationValue === null
      ? null
      : isRecord(locationValue) &&
          typeof locationValue['latitude'] === 'number' &&
          typeof locationValue['longitude'] === 'number' &&
          typeof locationValue['stale'] === 'boolean'
        ? {
            latitude: locationValue['latitude'],
            longitude: locationValue['longitude'],
            recordedAt: stringValue(locationValue, 'recordedAt'),
            stale: locationValue['stale'],
          }
        : (() => {
            throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
          })();
  return {
    orderId: stringValue(tracking, 'orderId'),
    deliveryTaskId: stringValue(tracking, 'deliveryTaskId'),
    orderNumber: stringValue(tracking, 'orderNumber'),
    orderStatus: stringValue(tracking, 'orderStatus'),
    taskStatus: stringValue(tracking, 'taskStatus'),
    captain,
    location,
    estimatedArrivalAt: nullableString(tracking, 'estimatedArrivalAt'),
    updatedAt: stringValue(tracking, 'updatedAt'),
  };
}

function parseDeliveryOtpEnvelope(value: DeliveryOtpResponse): CustomerDeliveryOtp {
  const envelope: unknown = value;
  if (
    !isRecord(envelope) ||
    field(envelope, 'success') !== true ||
    !isRecord(field(envelope, 'data'))
  ) {
    throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
  }
  const data = field(envelope, 'data');
  if (!isRecord(data)) {
    throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
  }
  const secret = field(data, 'secret');
  if (!isRecord(secret) || secret['kind'] !== 'DELIVERY_OTP') {
    throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
  }
  return {
    orderId: stringValue(secret, 'orderId'),
    secret: stringValue(secret, 'secret'),
    issuedAt: stringValue(secret, 'issuedAt'),
    expiresAt: stringValue(secret, 'expiresAt'),
  };
}

export class ApiCustomerOrderAdapter implements CustomerOrderReadPort, CustomerOrderTrackingPort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async listOrders(input: ListCustomerOrdersInput = {}): Promise<CustomerOrdersPage> {
    try {
      const response = await this.apiClient.request('listCustomerOrders', {
        query: {
          limit: input.limit ?? 20,
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        },
      });
      return parseCustomerOrdersPageEnvelope(response.data satisfies ListOrdersResponse);
    } catch (error: unknown) {
      if (error instanceof CustomerOrderError) throw error;
      throw mapApiFailure(error);
    }
  }

  public async getOrder(orderId: string): Promise<CustomerOrderDetail> {
    try {
      const response = await this.apiClient.request('getCustomerOrder', { path: { orderId } });
      return parseCustomerOrderDetailEnvelope(response.data satisfies GetOrderResponse);
    } catch (error: unknown) {
      if (error instanceof CustomerOrderError) throw error;
      throw mapApiFailure(error);
    }
  }

  public async getTracking(orderId: string): Promise<CustomerOrderTrackingSnapshot> {
    try {
      const response = await this.apiClient.request('getCustomerOrderTracking', {
        path: { orderId },
      });
      const tracking = parseTrackingEnvelope(response.data);
      if (tracking.orderId !== orderId) {
        throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
      }
      return tracking;
    } catch (error: unknown) {
      if (error instanceof CustomerOrderError) throw error;
      throw mapApiFailure(error);
    }
  }

  public async getDeliveryOtp(orderId: string): Promise<CustomerDeliveryOtp> {
    try {
      const response = await this.apiClient.request('getCustomerDeliveryOtp', {
        path: { orderId },
      });
      const otp = parseDeliveryOtpEnvelope(response.data);
      if (otp.orderId !== orderId) {
        throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
      }
      return otp;
    } catch (error: unknown) {
      if (error instanceof CustomerOrderError) throw error;
      throw mapApiFailure(error);
    }
  }
}
