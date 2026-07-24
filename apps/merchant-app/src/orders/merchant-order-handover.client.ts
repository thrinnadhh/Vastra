import type { ApiClient, OperationResponse } from '@vastra/api-client';

import {
  MERCHANT_DELIVERY_TASK_STATUSES,
  MerchantHandoverError,
  type MerchantDeliveryProjection,
  type MerchantHandoverFailureKind,
  type MerchantOrderHandoverPort,
  type MerchantPickupCode,
} from './merchant-order-handover.types';

type DeliveryResponse = OperationResponse<'getMerchantOrderDelivery'>;
type PickupCodeResponse = OperationResponse<'getMerchantPickupCode'>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function stringValue(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new MerchantHandoverError('MALFORMED_RESPONSE', null, false);
  }
  return value;
}

function nullableString(record: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new MerchantHandoverError('MALFORMED_RESPONSE', null, false);
  }
  return value;
}

function booleanValue(record: Readonly<Record<string, unknown>>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new MerchantHandoverError('MALFORMED_RESPONSE', null, false);
  }
  return value;
}

function envelopeData(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value) || value['success'] !== true || !isRecord(value['data'])) {
    throw new MerchantHandoverError('MALFORMED_RESPONSE', null, false);
  }
  return value['data'];
}

function taskStatus(
  record: Readonly<Record<string, unknown>>,
): MerchantDeliveryProjection['taskStatus'] {
  const value = stringValue(record, 'taskStatus');
  const status = MERCHANT_DELIVERY_TASK_STATUSES.find((candidate) => candidate === value);
  if (status === undefined) {
    throw new MerchantHandoverError('MALFORMED_RESPONSE', null, false);
  }
  return status;
}

export function parseMerchantDeliveryEnvelope(value: DeliveryResponse): MerchantDeliveryProjection {
  const delivery = envelopeData(value)['delivery'];
  if (!isRecord(delivery)) {
    throw new MerchantHandoverError('MALFORMED_RESPONSE', null, false);
  }
  return {
    orderId: stringValue(delivery, 'orderId'),
    deliveryTaskId: stringValue(delivery, 'deliveryTaskId'),
    orderNumber: stringValue(delivery, 'orderNumber'),
    orderStatus: stringValue(delivery, 'orderStatus'),
    taskStatus: taskStatus(delivery),
    captainAssigned: booleanValue(delivery, 'captainAssigned'),
    captainAtStore: booleanValue(delivery, 'captainAtStore'),
    pickedUpAt: nullableString(delivery, 'pickedUpAt'),
    updatedAt: stringValue(delivery, 'updatedAt'),
  };
}

export function parseMerchantPickupCodeEnvelope(value: PickupCodeResponse): MerchantPickupCode {
  const secret = envelopeData(value)['secret'];
  if (!isRecord(secret) || secret['kind'] !== 'PICKUP_CODE') {
    throw new MerchantHandoverError('MALFORMED_RESPONSE', null, false);
  }
  return {
    orderId: stringValue(secret, 'orderId'),
    deliveryTaskId: stringValue(secret, 'deliveryTaskId'),
    secret: stringValue(secret, 'secret'),
    issuedAt: stringValue(secret, 'issuedAt'),
    expiresAt: stringValue(secret, 'expiresAt'),
  };
}

function mapApiFailure(error: unknown): MerchantHandoverError {
  const normalized = isRecord(error) && isRecord(error['normalized']) ? error['normalized'] : null;
  if (normalized === null) return new MerchantHandoverError('UNKNOWN', null, false);

  let kind: MerchantHandoverFailureKind = 'UNKNOWN';
  switch (normalized['kind']) {
    case 'AUTHENTICATION':
      kind = 'AUTHENTICATION';
      break;
    case 'AUTHORIZATION':
      kind = 'FORBIDDEN';
      break;
    case 'NOT_FOUND':
      kind = 'NOT_FOUND';
      break;
    case 'CONFLICT':
    case 'VALIDATION':
      kind = 'INVALID_STATE';
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
  return new MerchantHandoverError(
    kind,
    typeof normalized['code'] === 'string' ? normalized['code'] : null,
    normalized['retryable'] === true,
  );
}

export class ApiMerchantOrderHandoverAdapter implements MerchantOrderHandoverPort {
  public constructor(private readonly apiClient: Pick<ApiClient, 'request'>) {}

  public async getDelivery(orderId: string): Promise<MerchantDeliveryProjection> {
    try {
      const response = await this.apiClient.request('getMerchantOrderDelivery', {
        path: { orderId },
      });
      const delivery = parseMerchantDeliveryEnvelope(response.data satisfies DeliveryResponse);
      if (delivery.orderId !== orderId) {
        throw new MerchantHandoverError('MALFORMED_RESPONSE', null, false);
      }
      return delivery;
    } catch (error: unknown) {
      if (error instanceof MerchantHandoverError) throw error;
      throw mapApiFailure(error);
    }
  }

  public async getPickupCode(orderId: string): Promise<MerchantPickupCode> {
    try {
      const response = await this.apiClient.request('getMerchantPickupCode', {
        path: { orderId },
      });
      const pickupCode = parseMerchantPickupCodeEnvelope(
        response.data satisfies PickupCodeResponse,
      );
      if (pickupCode.orderId !== orderId) {
        throw new MerchantHandoverError('MALFORMED_RESPONSE', null, false);
      }
      return pickupCode;
    } catch (error: unknown) {
      if (error instanceof MerchantHandoverError) throw error;
      throw mapApiFailure(error);
    }
  }
}
