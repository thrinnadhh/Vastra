import type { ApiErrorKind, NormalizedApiError } from './types';

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
  retryable: boolean;
  fieldErrors: Readonly<Record<string, readonly string[]>> | null;
}> => {
  if (!isRecord(payload)) {
    return { code: null, requestId: null, retryable: false, fieldErrors: null };
  }
  const error = isRecord(payload['error']) ? payload['error'] : null;
  const details = error !== null && isRecord(error['details']) ? error['details'] : null;
  const fieldErrorsValue = details !== null && isRecord(details['fieldErrors']) ? details['fieldErrors'] : null;
  const fieldErrors: Record<string, readonly string[]> = {};
  if (fieldErrorsValue !== null) {
    for (const [field, messages] of Object.entries(fieldErrorsValue)) {
      if (Array.isArray(messages) && messages.every((message) => typeof message === 'string')) {
        fieldErrors[field] = messages;
      }
    }
  }
  return {
    code: asSafeCode(error?.['code']),
    requestId: asSafeRequestId(payload['requestId']),
    retryable: error?.['retryable'] === true,
    fieldErrors: Object.keys(fieldErrors).length === 0 ? null : fieldErrors,
  };
};

const kindForStatus = (status: number): ApiErrorKind => {
  if (status === 401) return 'AUTHENTICATION';
  if (status === 403) return 'AUTHORIZATION';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422 || status === 400) return 'VALIDATION';
  if (status === 429) return 'RATE_LIMIT';
  return 'API';
};

export const parseRetryAfterMs = (value: string | null): number | null => {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.trunc(seconds * 1_000), MAX_RETRY_AFTER_MS);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(Math.max(0, timestamp - Date.now()), MAX_RETRY_AFTER_MS);
};

export const createLocalError = (
  kind: Extract<ApiErrorKind, 'AUTHENTICATION' | 'TRANSPORT' | 'TIMEOUT' | 'CONTRACT'>,
  operationId: string,
  requiresAuthoritativeRefresh = false,
): NormalizedApiError => ({
  kind,
  operationId,
  status: null,
  code: null,
  requestId: null,
  retryable: kind === 'TRANSPORT' || kind === 'TIMEOUT',
  retryAfterMs: null,
  fieldErrors: null,
  requiresAuthoritativeRefresh,
  userMessageKey: `api.${kind.toLowerCase()}`,
});

export const normalizeHttpError = ({
  operationId,
  status,
  payload,
  responseRequestId,
  retryAfter,
  method,
  allowedFieldErrors,
}: Readonly<{
  operationId: string;
  status: number;
  payload: unknown;
  responseRequestId: string | null;
  retryAfter: string | null;
  method: string;
  allowedFieldErrors?: readonly string[];
}>): NormalizedApiError => {
  const envelope = extractEnvelope(payload);
  const fieldErrors =
    envelope.fieldErrors === null || allowedFieldErrors === undefined
      ? null
      : Object.fromEntries(
          Object.entries(envelope.fieldErrors).filter(([field]) => allowedFieldErrors.includes(field)),
        );
  const kind = kindForStatus(status);
  return {
    kind,
    operationId,
    status,
    code: envelope.code,
    requestId: responseRequestId ?? envelope.requestId,
    retryable: envelope.retryable || status === 429 || status >= 500,
    retryAfterMs: parseRetryAfterMs(retryAfter),
    fieldErrors: fieldErrors !== null && Object.keys(fieldErrors).length > 0 ? fieldErrors : null,
    requiresAuthoritativeRefresh: method !== 'GET' && (status >= 500 || status === 409),
    userMessageKey: envelope.code === null ? `api.${kind.toLowerCase()}` : `api.code.${envelope.code}`,
  };
};

export class ApiClientError extends Error {
  public readonly normalized: NormalizedApiError;
  public readonly causeValue: unknown;

  public constructor(normalized: NormalizedApiError, causeValue?: unknown) {
    super(normalized.userMessageKey);
    this.name = 'ApiClientError';
    this.normalized = normalized;
    this.causeValue = causeValue;
  }
}
