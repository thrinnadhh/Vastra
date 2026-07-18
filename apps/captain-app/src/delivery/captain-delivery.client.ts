import {
  DELIVERY_PROBLEM_REASONS,
  DELIVERY_REJECTION_REASONS,
  DELIVERY_RELEASE_REASONS,
  type CaptainDelivery,
  type CaptainDeliveryPort,
  type DeliveryAddress,
  type DeliveryCompletion,
  type DeliveryLocation,
  type DeliveryProblem,
  type DeliveryProblemReason,
  type DeliveryRejectionReason,
  type DeliveryRelease,
  type DeliveryReleaseReason,
} from './captain-delivery.types';

type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;
type AccessTokenProvider = () => Promise<string | null>;

export class CaptainDeliveryApiError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'CaptainDeliveryApiError';
  }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError('Invalid delivery response');
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new TypeError('Invalid delivery response');
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null ? null : stringValue(value);
}
function numberValue(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed))
    throw new TypeError('Invalid delivery response');
  return parsed;
}
function nullableNumber(value: unknown): number | null {
  return value === null ? null : numberValue(value);
}
function booleanValue(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Invalid delivery response');
  return value;
}

function parseAddress(value: unknown): DeliveryAddress {
  const address = record(value);
  const location = record(address['location']);
  return {
    label: nullableString(address['label']),
    recipientName: nullableString(address['recipientName']),
    phoneNumber: nullableString(address['phoneNumber']),
    line1: stringValue(address['line1']),
    line2: nullableString(address['line2']),
    landmark: nullableString(address['landmark']),
    area: stringValue(address['area']),
    city: stringValue(address['city']),
    state: stringValue(address['state']),
    postalCode: stringValue(address['postalCode']),
    countryCode: stringValue(address['countryCode']),
    location: {
      latitude: numberValue(location['latitude']),
      longitude: numberValue(location['longitude']),
    },
  };
}

function parseDelivery(value: unknown): CaptainDelivery {
  const item = record(value);
  const taskStatus = String(item['taskStatus']);
  const assignmentStatus = String(item['assignmentStatus']);
  const orderStatus = String(item['orderStatus']);
  const paymentStatus = String(item['paymentStatus']);
  if (
    !['OFFERED', 'ASSIGNED', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROP'].includes(
      taskStatus,
    ) ||
    !['OFFERED', 'ACCEPTED'].includes(assignmentStatus) ||
    ![
      'CAPTAIN_SEARCHING',
      'CAPTAIN_ASSIGNED',
      'CAPTAIN_AT_STORE',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'CAPTAIN_AT_CUSTOMER',
    ].includes(orderStatus) ||
    !['COD_PENDING', 'COD_COLLECTED'].includes(paymentStatus)
  )
    throw new TypeError('Invalid delivery response');
  return {
    taskId: stringValue(item['taskId']),
    orderId: stringValue(item['orderId']),
    orderNumber: stringValue(item['orderNumber']),
    taskStatus: taskStatus as CaptainDelivery['taskStatus'],
    orderStatus: orderStatus as CaptainDelivery['orderStatus'],
    assignmentId: stringValue(item['assignmentId']),
    assignmentStatus: assignmentStatus as CaptainDelivery['assignmentStatus'],
    offeredEarningPaise: numberValue(item['offeredEarningPaise']),
    pickupDistanceMeters: nullableNumber(item['pickupDistanceMeters']),
    offeredAt: stringValue(item['offeredAt']),
    expiresAt: stringValue(item['expiresAt']),
    assignedAt: nullableString(item['assignedAt']),
    pickup: parseAddress(item['pickup']),
    drop: parseAddress(item['drop']),
    totalPaise: numberValue(item['totalPaise']),
    paymentStatus: paymentStatus as CaptainDelivery['paymentStatus'],
    replayed: booleanValue(item['replayed']),
  };
}

function parseCompletion(value: unknown): DeliveryCompletion {
  const item = record(value);
  if (
    item['taskStatus'] !== 'COMPLETED' ||
    item['orderStatus'] !== 'DELIVERED' ||
    item['paymentStatus'] !== 'COD_COLLECTED'
  )
    throw new TypeError('Invalid completion response');
  return {
    taskId: stringValue(item['taskId']),
    orderId: stringValue(item['orderId']),
    orderNumber: stringValue(item['orderNumber']),
    taskStatus: 'COMPLETED',
    orderStatus: 'DELIVERED',
    paymentStatus: 'COD_COLLECTED',
    collectedAmountPaise: numberValue(item['collectedAmountPaise']),
    captainEarningPaise: numberValue(item['captainEarningPaise']),
    completedAt: stringValue(item['completedAt']),
    replayed: booleanValue(item['replayed']),
  };
}

function parseProblem(value: unknown): DeliveryProblem {
  const item = record(value);
  const reason = stringValue(item['reason']) as DeliveryProblemReason;
  if (!DELIVERY_PROBLEM_REASONS.includes(reason) || item['orderStatus'] !== 'PROBLEM_REPORTED')
    throw new TypeError('Invalid problem response');
  return {
    taskId: stringValue(item['taskId']),
    orderId: stringValue(item['orderId']),
    reason,
    note: nullableString(item['note']),
    reportedAt: stringValue(item['reportedAt']),
    orderStatus: 'PROBLEM_REPORTED',
    replayed: booleanValue(item['replayed']),
  };
}

function parseRelease(value: unknown): DeliveryRelease {
  const item = record(value);
  const reason = stringValue(item['reason']) as DeliveryReleaseReason;
  if (
    !DELIVERY_RELEASE_REASONS.includes(reason) ||
    item['taskStatus'] !== 'SEARCHING' ||
    item['orderStatus'] !== 'CAPTAIN_SEARCHING'
  )
    throw new TypeError('Invalid release response');
  return {
    taskId: stringValue(item['taskId']),
    orderId: stringValue(item['orderId']),
    reason,
    releasedAt: stringValue(item['releasedAt']),
    taskStatus: 'SEARCHING',
    orderStatus: 'CAPTAIN_SEARCHING',
    replayed: booleanValue(item['replayed']),
  };
}

function readError(value: unknown): CaptainDeliveryApiError {
  const error = record(record(value)['error']);
  const retryable = error['retryable'];
  if (typeof retryable !== 'boolean') throw new TypeError('Invalid delivery error response');
  return new CaptainDeliveryApiError(
    stringValue(error['code']),
    stringValue(error['message']),
    retryable,
  );
}

function locationBody(location: DeliveryLocation | null): {
  readonly location: DeliveryLocation | null;
} {
  return { location };
}

export class HttpCaptainDeliveryClient implements CaptainDeliveryPort {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: AccessTokenProvider,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  public async listOffers(): Promise<readonly CaptainDelivery[]> {
    const offers = record(
      record(await this.request('/captain/delivery-offers', { method: 'GET' }))['data'],
    )['offers'];
    if (!Array.isArray(offers)) throw new TypeError('Invalid delivery offers response');
    return offers.map(parseDelivery);
  }
  public async getActive(): Promise<CaptainDelivery | null> {
    const value = record(
      record(await this.request('/captain/deliveries/active', { method: 'GET' }))['data'],
    )['delivery'];
    return value === null ? null : parseDelivery(value);
  }
  public async getTask(taskId: string): Promise<CaptainDelivery> {
    return this.delivery(`/captain/deliveries/${taskId}`, { method: 'GET' });
  }
  public async acceptOffer(assignmentId: string, key: string): Promise<CaptainDelivery> {
    return this.delivery(`/captain/delivery-offers/${assignmentId}/accept`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
    });
  }
  public async rejectOffer(
    assignmentId: string,
    reason: DeliveryRejectionReason,
    key: string,
  ): Promise<void> {
    if (!DELIVERY_REJECTION_REASONS.includes(reason))
      throw new TypeError('Invalid rejection reason');
    await this.command(`/captain/delivery-offers/${assignmentId}/reject`, key, { reason });
  }
  public async arrivePickup(
    taskId: string,
    location: DeliveryLocation,
    key: string,
  ): Promise<CaptainDelivery> {
    return this.deliveryCommand(taskId, 'arrive-pickup', key, locationBody(location));
  }
  public async verifyPickup(
    taskId: string,
    pickupCode: string,
    key: string,
  ): Promise<CaptainDelivery> {
    return this.deliveryCommand(taskId, 'verify-pickup', key, { pickupCode });
  }
  public async departPickup(
    taskId: string,
    location: DeliveryLocation | null,
    key: string,
  ): Promise<CaptainDelivery> {
    return this.deliveryCommand(taskId, 'depart-pickup', key, locationBody(location));
  }
  public async arriveDrop(
    taskId: string,
    location: DeliveryLocation | null,
    key: string,
  ): Promise<CaptainDelivery> {
    return this.deliveryCommand(taskId, 'arrive-drop', key, locationBody(location));
  }
  public async complete(
    taskId: string,
    collectedAmountPaise: number,
    deliveryOtp: string,
    location: DeliveryLocation | null,
    key: string,
  ): Promise<DeliveryCompletion> {
    const body = record(
      await this.command(`/captain/deliveries/${taskId}/complete`, key, {
        collectedAmountPaise,
        deliveryOtp,
        location,
      }),
    );
    return parseCompletion(record(body['data'])['completion']);
  }
  public async reportProblem(
    taskId: string,
    reason: DeliveryProblemReason,
    note: string | null,
    location: DeliveryLocation | null,
    key: string,
  ): Promise<DeliveryProblem> {
    if (!DELIVERY_PROBLEM_REASONS.includes(reason)) throw new TypeError('Invalid problem reason');
    const body = record(
      await this.command(`/captain/deliveries/${taskId}/report-problem`, key, {
        reason,
        note,
        location,
      }),
    );
    return parseProblem(record(body['data'])['problem']);
  }
  public async release(
    taskId: string,
    reason: DeliveryReleaseReason,
    note: string | null,
    location: DeliveryLocation | null,
    key: string,
  ): Promise<DeliveryRelease> {
    if (!DELIVERY_RELEASE_REASONS.includes(reason)) throw new TypeError('Invalid release reason');
    const body = record(
      await this.command(`/captain/deliveries/${taskId}/release`, key, { reason, note, location }),
    );
    return parseRelease(record(body['data'])['release']);
  }

  private async deliveryCommand(
    taskId: string,
    action: string,
    key: string,
    body: unknown,
  ): Promise<CaptainDelivery> {
    return this.delivery(`/captain/deliveries/${taskId}/${action}`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(body),
    });
  }
  private async delivery(path: string, init: RequestInit): Promise<CaptainDelivery> {
    const body = record(await this.request(path, init));
    return parseDelivery(record(body['data'])['delivery']);
  }
  private async command(path: string, key: string, body: unknown): Promise<unknown> {
    return this.request(path, {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(body),
    });
  }
  private async request(path: string, init: RequestInit): Promise<unknown> {
    const token = await this.getAccessToken();
    if (token === null)
      throw new CaptainDeliveryApiError('AUTHENTICATION_REQUIRED', 'Sign in again.', false);
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');
    const response = await this.fetchFunction(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers,
    });
    const body: unknown = await response.json();
    if (!response.ok) throw readError(body);
    return body;
  }
}
