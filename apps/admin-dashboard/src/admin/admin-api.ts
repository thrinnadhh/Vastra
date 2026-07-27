/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { ApiClient } from '@vastra/api-client';

import {
  AdminContractError,
  parseAudit,
  parseCapabilities,
  parseCaptainPage,
  parseCaptainSnapshot,
  parseDashboard,
  parseInvestigation,
  parseMerchantPage,
  parseMerchantSnapshot,
  parseOperationOutcome,
  parseOrderPage,
  parseSearchResults,
} from './admin-contracts';
import type {
  AdminFailure,
  AdminMutationInput,
  AdminOperationOutcome,
  AdminPort,
  AdminResult,
  AdminReasonCode,
} from './admin-types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function createIdempotencyKey(): string {
  const candidate = globalThis.crypto?.randomUUID?.();
  if (candidate !== undefined && UUID_PATTERN.test(candidate)) return candidate;
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failure(error: unknown): AdminFailure {
  if (error instanceof AdminContractError) {
    return {
      kind: 'CONTRACT',
      message: 'The server returned an unexpected response. Refresh before continuing.',
      requestId: null,
      requiresRefresh: true,
    };
  }
  const normalized = isRecord(error) && isRecord(error['normalized']) ? error['normalized'] : null;
  const kind = normalized?.['kind'];
  const status = normalized?.['status'];
  const requestId = typeof normalized?.['requestId'] === 'string' ? normalized['requestId'] : null;
  if (kind === 'TRANSPORT' || kind === 'TIMEOUT') {
    return {
      kind: 'OFFLINE',
      message: 'Connection unavailable. Check the network and retry.',
      requestId,
      requiresRefresh: false,
    };
  }
  if (kind === 'AUTHENTICATION' || status === 401) {
    return {
      kind: 'SESSION_EXPIRED',
      message: 'Your admin session expired. Sign in again.',
      requestId,
      requiresRefresh: false,
    };
  }
  if (kind === 'AUTHORIZATION' || status === 403) {
    return {
      kind: 'UNAUTHORIZED',
      message: 'You do not have permission for this operation.',
      requestId,
      requiresRefresh: false,
    };
  }
  if (kind === 'VALIDATION' || status === 400) {
    return {
      kind: 'VALIDATION',
      message: 'Review the requested values and try again.',
      requestId,
      requiresRefresh: false,
    };
  }
  if (kind === 'CONFLICT' || status === 409) {
    return {
      kind: 'CONFLICT',
      message: 'The operational state changed. Refresh before retrying.',
      requestId,
      requiresRefresh: true,
    };
  }
  if (kind === 'NOT_FOUND' || status === 404) {
    return {
      kind: 'NOT_FOUND',
      message: 'The requested record is no longer available.',
      requestId,
      requiresRefresh: true,
    };
  }
  if (kind === 'CONTRACT') {
    return {
      kind: 'CONTRACT',
      message: 'The server response could not be verified.',
      requestId,
      requiresRefresh: true,
    };
  }
  if (kind === 'API' || kind === 'RATE_LIMIT' || status === 503) {
    return {
      kind: 'UNAVAILABLE',
      message: 'The operations service is temporarily unavailable.',
      requestId,
      requiresRefresh: true,
    };
  }
  return {
    kind: 'UNKNOWN',
    message: 'The operation could not be completed.',
    requestId,
    requiresRefresh: true,
  };
}

async function read<T>(
  operation: () => Promise<{ data: unknown; requestId: string }>,
  parser: (value: unknown) => T,
): Promise<AdminResult<T>> {
  try {
    const response = await operation();
    return { kind: 'SUCCESS', data: parser(response.data), requestId: response.requestId };
  } catch (error: unknown) {
    return { kind: 'FAILURE', failure: failure(error) };
  }
}

function mutationBody(input: AdminMutationInput): { reasonCode: AdminReasonCode; note?: string } {
  return input.note === null
    ? { reasonCode: input.reasonCode }
    : { reasonCode: input.reasonCode, note: input.note };
}

export class ApiAdminPort implements AdminPort {
  public constructor(private readonly client: ApiClient) {}

  public capabilities() {
    return read(() => this.client.request('getAdminCapabilities', {}), parseCapabilities);
  }

  public dashboard() {
    return read(() => this.client.request('getAdminOperationsDashboard', {}), parseDashboard);
  }

  public search(query: string, limit = 20) {
    return read(
      () => this.client.request('searchAdminOperations', { query: { q: query, limit } }),
      parseSearchResults,
    );
  }

  public orders(input: Parameters<AdminPort['orders']>[0]) {
    const query = {
      ...(input.queue === undefined || input.queue === 'ALL' ? {} : { queue: input.queue }),
      ...(input.status === undefined || input.status === '' ? {} : { status: input.status }),
      ...(input.shopId === undefined || input.shopId === '' ? {} : { shopId: input.shopId }),
      ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      ...(input.limit === undefined ? {} : { limit: input.limit }),
    };
    return read(() => this.client.request('listAdminOperationalOrders', { query }), parseOrderPage);
  }

  public order(orderId: string) {
    return read(
      () => this.client.request('getAdminOrderInvestigation', { path: { orderId } }),
      parseInvestigation,
    );
  }

  public merchants(input: Parameters<AdminPort['merchants']>[0]) {
    const query = {
      ...(input.query === undefined || input.query === '' ? {} : { q: input.query }),
      ...(input.profileStatus === undefined || input.profileStatus === ''
        ? {}
        : { profileStatus: input.profileStatus }),
      ...(input.onboardingStatus === undefined || input.onboardingStatus === ''
        ? {}
        : { onboardingStatus: input.onboardingStatus }),
      ...(input.kycStatus === undefined || input.kycStatus === ''
        ? {}
        : { kycStatus: input.kycStatus }),
      ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      ...(input.limit === undefined ? {} : { limit: input.limit }),
    };
    return read(() => this.client.request('listAdminMerchants', { query }), parseMerchantPage);
  }

  public merchant(merchantId: string) {
    return read(
      () => this.client.request('getAdminMerchantOperations', { path: { merchantId } }),
      parseMerchantSnapshot,
    );
  }

  public captains(input: Parameters<AdminPort['captains']>[0]) {
    const query = {
      ...(input.query === undefined || input.query === '' ? {} : { q: input.query }),
      ...(input.profileStatus === undefined || input.profileStatus === ''
        ? {}
        : { profileStatus: input.profileStatus }),
      ...(input.kycStatus === undefined || input.kycStatus === ''
        ? {}
        : { kycStatus: input.kycStatus }),
      ...(input.availabilityStatus === undefined || input.availabilityStatus === ''
        ? {}
        : { availabilityStatus: input.availabilityStatus }),
      ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      ...(input.limit === undefined ? {} : { limit: input.limit }),
    };
    return read(() => this.client.request('listAdminCaptains', { query }), parseCaptainPage);
  }

  public captain(captainId: string) {
    return read(
      () => this.client.request('getAdminCaptainOperations', { path: { captainId } }),
      parseCaptainSnapshot,
    );
  }

  public audit(input: Parameters<AdminPort['audit']>[0] = {}) {
    const query = {
      ...(input.resourceType === undefined ? {} : { resourceType: input.resourceType }),
      ...(input.resourceId === undefined || input.resourceId === ''
        ? {}
        : { resourceId: input.resourceId }),
      ...(input.actorId === undefined || input.actorId === '' ? {} : { actorId: input.actorId }),
      ...(input.limit === undefined ? {} : { limit: input.limit }),
    };
    return read(() => this.client.request('listAdminAudit', { query }), parseAudit);
  }

  private operation(
    operation: () => Promise<{ data: unknown; requestId: string }>,
  ): Promise<AdminResult<AdminOperationOutcome>> {
    return read(operation, parseOperationOutcome);
  }

  public cancelOrder(orderId: string, input: AdminMutationInput) {
    return this.operation(() =>
      this.client.request('cancelAdminOrderOperation', {
        path: { orderId },
        headers: { 'Idempotency-Key': input.idempotencyKey },
        body: mutationBody(input),
      }),
    );
  }

  public retryDispatch(orderId: string, input: AdminMutationInput) {
    return this.operation(() =>
      this.client.request('retryAdminOrderDispatch', {
        path: { orderId },
        headers: { 'Idempotency-Key': input.idempotencyKey },
        body: mutationBody(input),
      }),
    );
  }

  public releaseDelivery(taskId: string, input: AdminMutationInput) {
    return this.operation(() =>
      this.client.request('releaseAdminDeliveryOperation', {
        path: { taskId },
        headers: { 'Idempotency-Key': input.idempotencyKey },
        body: mutationBody(input),
      }),
    );
  }

  public resetVerification(
    taskId: string,
    verificationKind: 'PICKUP_CODE' | 'DELIVERY_OTP',
    input: AdminMutationInput,
  ) {
    return this.operation(() =>
      this.client.request('resetAdminDeliveryVerification', {
        path: { taskId },
        headers: { 'Idempotency-Key': input.idempotencyKey },
        body: { ...mutationBody(input), verificationKind },
      }),
    );
  }

  public assignCaptain(taskId: string, captainId: string, idempotencyKey: string) {
    return this.operation(() =>
      this.client.request('assignAdminDeliveryTask', {
        path: { taskId },
        headers: { 'Idempotency-Key': idempotencyKey },
        body: { captainId },
      }),
    );
  }

  public overrideDeliveryOtp(
    taskId: string,
    collectedAmountPaise: number,
    reason: string,
    idempotencyKey: string,
  ) {
    return this.operation(() =>
      this.client.request('overrideAdminDeliveryOtp', {
        path: { taskId },
        headers: { 'Idempotency-Key': idempotencyKey },
        body: { collectedAmountPaise, reason },
      }),
    );
  }

  private actorMutation<T>(
    operation: () => Promise<{ data: unknown; requestId: string }>,
    parser: (value: unknown) => T,
  ) {
    return read(operation, parser);
  }

  public approveMerchant(merchantId: string, input: AdminMutationInput) {
    return this.actorMutation(
      () =>
        this.client.request('approveAdminMerchant', {
          path: { merchantId },
          headers: { 'Idempotency-Key': input.idempotencyKey },
          body: mutationBody(input),
        }),
      parseMerchantSnapshot,
    );
  }

  public pauseMerchant(merchantId: string, input: AdminMutationInput) {
    return this.actorMutation(
      () =>
        this.client.request('pauseAdminMerchantOrders', {
          path: { merchantId },
          headers: { 'Idempotency-Key': input.idempotencyKey },
          body: mutationBody(input),
        }),
      parseMerchantSnapshot,
    );
  }

  public suspendMerchant(merchantId: string, input: AdminMutationInput) {
    return this.actorMutation(
      () =>
        this.client.request('suspendAdminMerchant', {
          path: { merchantId },
          headers: { 'Idempotency-Key': input.idempotencyKey },
          body: mutationBody(input),
        }),
      parseMerchantSnapshot,
    );
  }

  public restoreMerchant(merchantId: string, input: AdminMutationInput) {
    return this.actorMutation(
      () =>
        this.client.request('restoreAdminMerchant', {
          path: { merchantId },
          headers: { 'Idempotency-Key': input.idempotencyKey },
          body: mutationBody(input),
        }),
      parseMerchantSnapshot,
    );
  }

  public approveCaptain(captainId: string, input: AdminMutationInput) {
    return this.actorMutation(
      () =>
        this.client.request('approveAdminCaptain', {
          path: { captainId },
          headers: { 'Idempotency-Key': input.idempotencyKey },
          body: mutationBody(input),
        }),
      parseCaptainSnapshot,
    );
  }

  public suspendCaptain(captainId: string, input: AdminMutationInput) {
    return this.actorMutation(
      () =>
        this.client.request('suspendAdminCaptain', {
          path: { captainId },
          headers: { 'Idempotency-Key': input.idempotencyKey },
          body: mutationBody(input),
        }),
      parseCaptainSnapshot,
    );
  }

  public restoreCaptain(captainId: string, input: AdminMutationInput) {
    return this.actorMutation(
      () =>
        this.client.request('restoreAdminCaptain', {
          path: { captainId },
          headers: { 'Idempotency-Key': input.idempotencyKey },
          body: mutationBody(input),
        }),
      parseCaptainSnapshot,
    );
  }

  public correctCaptainAvailability(
    captainId: string,
    targetAvailability: 'OFFLINE' | 'AVAILABLE' | 'ON_BREAK',
    input: AdminMutationInput,
  ) {
    return this.actorMutation(
      () =>
        this.client.request('correctAdminCaptainAvailability', {
          path: { captainId },
          headers: { 'Idempotency-Key': input.idempotencyKey },
          body: { ...mutationBody(input), targetAvailability },
        }),
      parseCaptainSnapshot,
    );
  }

  public releaseCaptainAssignment(captainId: string, input: AdminMutationInput) {
    return this.actorMutation(
      () =>
        this.client.request('releaseAdminCaptainAssignment', {
          path: { captainId },
          headers: { 'Idempotency-Key': input.idempotencyKey },
          body: mutationBody(input),
        }),
      parseCaptainSnapshot,
    );
  }
}
