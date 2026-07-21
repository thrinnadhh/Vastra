import type { ApiErrorKind, NormalizedApiError } from './types.js';

const MAX_RETRY_AFTER_MS = 30_000;
const SAFE_CODE = /^[A-Z0-9_.:-]{1,80}$/u;
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{1,128}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asSafeCode = (value: unknown): string | null =>
  typeof value === 'string' && SAFE_CODE.test(value) ? value : null;

const asSafeRequestId = (value: unknown): string | null =>
  typeof value === 'string' && SAFE_REQUEST_ID.test(value) ? value : null;

const extractEnvelope = (
  payload: unknown,
): Readonly<{
  code: string | null;
  requestId: string | null;
  retryable: boolean | null;
  details: Record<string, unknown> | null;
}> => {
  if (!isRecord(payload)) {
    return { code: null, requestId: null, retryable: null, details: null };
  }

  const error = isRecord(payload['error']) ? payload['error'] : null;
  return {
    code: asSafeCode(error?.['code']),
    requestId: asSafeRequestId(payload['requestId']),
    retryable: typeof error?.['retryable'] === 'boolean' ? error['retryable'] : null,
    details: isRecord(error?.['details']) ? error['details'] : null,
  };
};

const extractFieldErrors = (
  details: Record<string, unknown> | null,
  allowlist: readonly string[],
): Readonly<Record<string, readonly string[]>> | null => {
  if (details === null || allowlist.length === 0) {
    return null;
  }

  const candidate = isRecord(details['fieldErrors']) ? details['fieldErrors'] : details;
  const output: Record<string, readonly string[]> = {};
  for (const field of allowlist) {
    const messages = candidate[field];
    if (!Array.isArray(messages)) {
      continue;
    }
    const safeMessages = messages
      .filter((message): message is string => typeof message === 'string')
      .slice(0, 8);
    if (safeMessages.length > 0) {
      output[field] = safeMessages;
    }
  }

  return Object.keys(output).length > 0 ? output : null;
};

export const parseRetryAfterMs = (value: string | null, nowMs = Date.now()): number | null => {
  if (value === null) {
    return null;
  }

  const seconds = Number(value);
  const parsed = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(value) - nowMs;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_RETRY_AFTER_MS) {
    return null;
  }

  return Math.ceil(parsed);
};

const kindForStatus = (status: number): ApiErrorKind => {
  switch (status) {
    case 400:
    case 422:
      return 'VALIDATION';
    case 401:
      return 'AUTHENTICATION';
    case 403:
      return 'AUTHORIZATION';
    case 404:
      return 'NOT_FOUND';
    case 409:
    case 410:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMIT';
    default:
      return 'API';
  }
};

const messageKeyFor = (kind: ApiErrorKind): string => {
  switch (kind) {
    case 'AUTHENTICATION':
      return 'api.error.authentication';
    case 'AUTHORIZATION':
      return 'api.error.authorization';
    case 'VALIDATION':
      return 'api.error.validation';
    case 'NOT_FOUND':
      return 'api.error.notFound';
    case 'CONFLICT':
      return 'api.error.conflict';
    case 'RATE_LIMIT':
      return 'api.error.rateLimit';
    case 'TRANSPORT':
      return 'api.error.transport';
    case 'TIMEOUT':
      return 'api.error.timeout';
    case 'CONTRACT':
      return 'api.error.contract';
    case 'API':
      return 'api.error.server';
    case 'UNKNOWN':
      return 'api.error.unknown';
  }
};

export type HttpErrorInput = Readonly<{
  operationId: string;
  status: number;
  payload: unknown;
  responseRequestId?: string | null;
  retryAfter?: string | null;
  method: string;
  allowedFieldErrors?: readonly string[];
}>;

export const normalizeHttpError = (input: HttpErrorInput): NormalizedApiError => {
  const envelope = extractEnvelope(input.payload);
  const kind = kindForStatus(input.status);
  const isMutation = input.method.toUpperCase() !== 'GET';
  const serverRetryable = envelope.retryable !== false;
  const retryableStatus = input.status >= 500 || input.status === 429;
  const retryAfterMs = kind === 'RATE_LIMIT' ? parseRetryAfterMs(input.retryAfter ?? null) : null;
  const retryable =
    !isMutation &&
    serverRetryable &&
    retryableStatus &&
    (kind !== 'RATE_LIMIT' || retryAfterMs !== null);

  return {
    kind,
    operationId: input.operationId,
    status: input.status,
    code: envelope.code,
    requestId: asSafeRequestId(input.responseRequestId) ?? envelope.requestId,
    retryable,
    retryAfterMs,
    fieldErrors:
      kind === 'VALIDATION'
        ? extractFieldErrors(envelope.details, input.allowedFieldErrors ?? [])
        : null,
    requiresAuthoritativeRefresh: kind === 'CONFLICT' || (isMutation && input.status >= 500),
    userMessageKey: messageKeyFor(kind),
  };
};

export const createLocalError = (
  kind: Extract<ApiErrorKind, 'AUTHENTICATION' | 'TRANSPORT' | 'TIMEOUT' | 'CONTRACT' | 'UNKNOWN'>,
  operationId: string,
  requiresAuthoritativeRefresh = false,
): NormalizedApiError => ({
  kind,
  operationId,
  status: null,
  code: null,
  requestId: null,
  retryable: kind === 'TRANSPORT' && !requiresAuthoritativeRefresh,
  retryAfterMs: null,
  fieldErrors: null,
  requiresAuthoritativeRefresh,
  userMessageKey: messageKeyFor(kind),
});

export class ApiClientError extends Error {
  readonly normalized: NormalizedApiError;
  readonly causeValue: unknown;

  constructor(normalized: NormalizedApiError, causeValue?: unknown) {
    super(normalized.userMessageKey);
    this.name = 'ApiClientError';
    this.normalized = normalized;
    this.causeValue = causeValue;
  }
}
