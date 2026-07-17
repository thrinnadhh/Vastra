import {
  CAPTAIN_AVAILABILITY_STATUSES,
  type CaptainAvailabilityResult,
  type CaptainAvailabilityStatus,
  type CaptainLocationResult,
  type CaptainLocationSample,
  type CaptainPresencePort,
  type CaptainRequestedAvailabilityStatus,
} from './captain-presence.types';

type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;
type AccessTokenProvider = () => Promise<string | null>;

export class CaptainPresenceApiError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'CaptainPresenceApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAvailabilityStatus(value: unknown): value is CaptainAvailabilityStatus {
  return (
    typeof value === 'string' &&
    CAPTAIN_AVAILABILITY_STATUSES.some((candidate) => candidate === value)
  );
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError('Invalid captain presence response');
  return value;
}

function readError(value: unknown): CaptainPresenceApiError {
  const body = requireRecord(value);
  const error = requireRecord(body['error']);
  const code = error['code'];
  const message = error['message'];
  const retryable = error['retryable'];

  if (typeof code !== 'string' || typeof message !== 'string' || typeof retryable !== 'boolean') {
    throw new TypeError('Invalid captain presence error response');
  }

  return new CaptainPresenceApiError(code, message, retryable);
}

function parseAvailabilityResponse(value: unknown): CaptainAvailabilityResult {
  const body = requireRecord(value);
  if (body['success'] !== true) throw new TypeError('Invalid captain presence response');
  const data = requireRecord(body['data']);
  const availability = requireRecord(data['availability']);
  const status = availability['availabilityStatus'];
  const locationValue = availability['location'];

  if (
    !isAvailabilityStatus(status) ||
    typeof availability['dispatchEligible'] !== 'boolean' ||
    typeof availability['changed'] !== 'boolean'
  ) {
    throw new TypeError('Invalid captain presence response');
  }

  let locationFresh: boolean | null = null;
  let locationRecordedAt: string | null = null;

  if (locationValue !== null) {
    const location = requireRecord(locationValue);
    if (typeof location['fresh'] !== 'boolean' || typeof location['recordedAt'] !== 'string') {
      throw new TypeError('Invalid captain presence response');
    }
    locationFresh = location['fresh'];
    locationRecordedAt = location['recordedAt'];
  }

  return {
    availabilityStatus: status,
    dispatchEligible: availability['dispatchEligible'],
    changed: availability['changed'],
    locationFresh,
    locationRecordedAt,
  };
}

function parseLocationResponse(value: unknown): CaptainLocationResult {
  const body = requireRecord(value);
  if (body['success'] !== true) throw new TypeError('Invalid captain location response');
  const data = requireRecord(body['data']);
  const location = requireRecord(data['location']);

  if (
    typeof location['sampleId'] !== 'string' ||
    typeof location['acceptedAt'] !== 'string' ||
    typeof location['replayed'] !== 'boolean'
  ) {
    throw new TypeError('Invalid captain location response');
  }

  return {
    sampleId: location['sampleId'],
    acceptedAt: location['acceptedAt'],
    replayed: location['replayed'],
  };
}

export class HttpCaptainPresenceClient implements CaptainPresencePort {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: AccessTokenProvider,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  public async getAvailability(): Promise<CaptainAvailabilityStatus> {
    const body = await this.request('/me', { method: 'GET' });
    const response = requireRecord(body);
    if (response['success'] !== true) throw new TypeError('Invalid current account response');
    const data = requireRecord(response['data']);
    const roleProfile = requireRecord(data['roleProfile']);
    const status = roleProfile['availabilityStatus'];
    if (!isAvailabilityStatus(status)) throw new TypeError('Invalid current account response');
    return status;
  }

  public async setAvailability(
    status: CaptainRequestedAvailabilityStatus,
  ): Promise<CaptainAvailabilityResult> {
    return parseAvailabilityResponse(
      await this.request('/captain/me/availability', {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    );
  }

  public async updateLocation(sample: CaptainLocationSample): Promise<CaptainLocationResult> {
    return parseLocationResponse(
      await this.request('/captain/me/location', {
        method: 'PUT',
        body: JSON.stringify(sample),
      }),
    );
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const accessToken = await this.getAccessToken();
    if (accessToken === null) {
      throw new CaptainPresenceApiError('AUTHENTICATION_REQUIRED', 'Sign in again.', false);
    }

    const response = await this.fetchFunction(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
    });
    const body: unknown = await response.json();
    if (!response.ok) throw readError(body);
    return body;
  }
}
