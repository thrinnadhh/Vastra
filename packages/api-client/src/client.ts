import {
  OPENAPI_OPERATIONS,
  OPENAPI_SCHEMAS,
  type OperationId,
  type OperationRequest,
  type OperationResponse,
} from './generated/openapi.js';
import { ApiClientError, createLocalError, normalizeHttpError } from './errors.js';
import { writeClientLog } from './logging.js';
import { validateJsonSchema, type JsonSchema, type SchemaRegistry } from './schema.js';
import type {
  AbortSignalLike,
  AccessTokenProvider,
  ActorType,
  ApiClientLogger,
  ApiClientResponse,
  FetchLike,
  FetchRequestInitLike,
  RequestIdProvider,
} from './types.js';

export type OperationRuntimeContract = Readonly<{
  method: string;
  path: string;
  requiresAuth: boolean;
  responses: Readonly<Record<string, JsonSchema | null>>;
}>;

export type OperationRegistry = Readonly<Record<string, OperationRuntimeContract>>;

export type ApiClientOptions = Readonly<{
  baseUrl: string;
  fetch: FetchLike;
  accessTokenProvider: AccessTokenProvider;
  requestIdProvider?: RequestIdProvider;
  logger?: ApiClientLogger;
  defaultTimeoutMs?: number;
  actor?: ActorType;
  appVersion?: string;
}>;

export type RequestOptions = Readonly<{
  timeoutMs?: number;
  signal?: AbortSignalLike;
  allowedFieldErrors?: readonly string[];
  attempt?: number;
}>;

export type ApiClient = Readonly<{
  request: <Id extends OperationId>(
    operationId: Id,
    input: OperationRequest<Id>,
    options?: RequestOptions,
  ) => Promise<ApiClientResponse<OperationResponse<Id>>>;
}>;

export type TestingApiClient = Readonly<{
  request: (
    operationId: string,
    input: unknown,
    options?: RequestOptions,
  ) => Promise<ApiClientResponse<unknown>>;
}>;

type CryptoLike = Readonly<{
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}>;

type AbortControllerLike = Readonly<{
  signal: AbortSignalLike;
  abort: () => void;
}>;

type AbortControllerConstructorLike = new () => AbortControllerLike;

const globalRuntime = globalThis as unknown as {
  crypto?: CryptoLike;
  AbortController?: AbortControllerConstructorLike;
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const defaultRequestIdProvider = (): string => {
  const randomUuid = globalRuntime.crypto?.randomUUID;
  if (randomUuid !== undefined) {
    return randomUuid.call(globalRuntime.crypto);
  }

  const bytes = new Uint8Array(16);
  if (globalRuntime.crypto?.getRandomValues !== undefined) {
    globalRuntime.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asInputRecord = (input: unknown): Record<string, unknown> => (isRecord(input) ? input : {});

const serializeUrlValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  throw new Error('URL parameters must be strings, finite numbers, or booleans');
};

const buildPath = (template: string, pathInput: unknown): string => {
  const values = isRecord(pathInput) ? pathInput : {};
  return template.replaceAll(/\{([^}]+)\}/gu, (_match, key: string) => {
    const value = values[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter: ${key}`);
    }
    return encodeURIComponent(serializeUrlValue(value));
  });
};

const buildQuery = (queryInput: unknown): string => {
  if (!isRecord(queryInput)) {
    return '';
  }

  const pairs: string[] = [];
  for (const key of Object.keys(queryInput).sort()) {
    const rawValue = queryInput[key];
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value !== undefined && value !== null) {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(serializeUrlValue(value))}`);
      }
    }
  }

  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
};

const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{1,128}$/u;

const requestIdFromPayload = (payload: unknown): string | null => {
  if (!isRecord(payload)) {
    return null;
  }
  const meta = isRecord(payload['meta']) ? payload['meta'] : null;
  const candidate = meta?.['requestId'] ?? payload['requestId'];
  return typeof candidate === 'string' && SAFE_REQUEST_ID.test(candidate) ? candidate : null;
};

const schemaForStatus = (contract: OperationRuntimeContract, status: number): JsonSchema | null =>
  contract.responses[String(status)] ??
  contract.responses[`${String(Math.floor(status / 100))}XX`] ??
  contract.responses['default'] ??
  null;

const decodePayload = async (response: Awaited<ReturnType<FetchLike>>): Promise<unknown> => {
  try {
    return await response.json();
  } catch (cause) {
    throw new ApiClientError(createLocalError('CONTRACT', 'unknown'), cause);
  }
};

const withTimeout = async <T>(
  operation: (signal: AbortSignalLike | undefined) => Promise<T>,
  timeoutMs: number,
  externalSignal: AbortSignalLike | undefined,
): Promise<T> => {
  const Controller = globalRuntime.AbortController;
  const controller = Controller === undefined ? null : new Controller();
  let timeoutHandle: unknown;

  const abortFromExternal = (): void => controller?.abort();
  externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });

  try {
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutHandle = globalRuntime.setTimeout(() => {
        controller?.abort();
        reject(new Error('API_CLIENT_TIMEOUT'));
      }, timeoutMs);
    });

    return await Promise.race([operation(controller?.signal ?? externalSignal), timeoutPromise]);
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'API_CLIENT_TIMEOUT') {
      throw new ApiClientError(createLocalError('TIMEOUT', 'unknown'), cause);
    }
    throw cause;
  } finally {
    if (timeoutHandle !== undefined) {
      globalRuntime.clearTimeout(timeoutHandle);
    }
    externalSignal?.removeEventListener?.('abort', abortFromExternal);
  }
};

const createClientForRegistry = (
  options: ApiClientOptions,
  operations: OperationRegistry,
  schemas: SchemaRegistry,
): TestingApiClient => {
  const baseUrl = options.baseUrl.replace(/\/+$/u, '');
  const requestIdProvider = options.requestIdProvider ?? defaultRequestIdProvider;
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;

  const request = async (
    operationId: string,
    typedInput: unknown,
    requestOptions: RequestOptions = {},
  ): Promise<ApiClientResponse<unknown>> => {
    const startedAt = Date.now();
    const attempt = requestOptions.attempt ?? 1;
    const contract = operations[operationId];
    if (contract === undefined) {
      throw new ApiClientError(createLocalError('CONTRACT', operationId));
    }

    const input = asInputRecord(typedInput);
    const requestId = requestIdProvider();
    let accessToken: string | null;
    try {
      accessToken = await options.accessTokenProvider.getAccessToken();
    } catch (cause) {
      const normalized = createLocalError('AUTHENTICATION', operationId);
      writeClientLog(options.logger, {
        phase: 'failure',
        operationId,
        kind: normalized.kind,
        requestId,
        attempt,
        durationMs: Date.now() - startedAt,
        actor: options.actor,
        appVersion: options.appVersion,
      });
      throw new ApiClientError(normalized, cause);
    }
    if (contract.requiresAuth && (accessToken === null || accessToken.length === 0)) {
      const normalized = createLocalError('AUTHENTICATION', operationId);
      writeClientLog(options.logger, {
        phase: 'failure',
        operationId,
        kind: normalized.kind,
        requestId,
        attempt,
        durationMs: Date.now() - startedAt,
        actor: options.actor,
        appVersion: options.appVersion,
      });
      throw new ApiClientError(normalized);
    }

    const path = buildPath(contract.path, input['path']);
    const query = buildQuery(input['query']);
    const inputHeaders = isRecord(input['headers']) ? input['headers'] : {};
    const headers: Record<string, string> = {};
    const protectedHeaders = new Set(['authorization', 'cookie', 'x-request-id']);
    for (const [key, value] of Object.entries(inputHeaders)) {
      if (typeof value === 'string' && !protectedHeaders.has(key.toLowerCase())) {
        headers[key] = value;
      }
    }
    headers['Accept'] = 'application/json';
    headers['X-Request-Id'] = requestId;
    if (accessToken !== null && accessToken.length > 0) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const bodyValue = input['body'];
    const init: FetchRequestInitLike = {
      method: contract.method,
      headers,
      ...(bodyValue === undefined ? {} : { body: JSON.stringify(bodyValue) }),
    };
    if (bodyValue !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    writeClientLog(options.logger, {
      phase: 'request',
      operationId,
      requestId,
      attempt,
      actor: options.actor,
      appVersion: options.appVersion,
    });

    try {
      const response = await withTimeout(
        (signal) =>
          options.fetch(
            `${baseUrl}${path}${query}`,
            signal === undefined ? init : { ...init, signal },
          ),
        requestOptions.timeoutMs ?? defaultTimeoutMs,
        requestOptions.signal,
      );
      const payload = await decodePayload(response);
      const responseRequestId =
        response.headers.get('x-request-id') ?? requestIdFromPayload(payload) ?? requestId;
      const schema = schemaForStatus(contract, response.status);
      if (schema === null || !validateJsonSchema(schema, payload, schemas)) {
        const normalized = createLocalError(
          'CONTRACT',
          operationId,
          !response.ok && contract.method !== 'GET',
        );
        writeClientLog(options.logger, {
          phase: 'failure',
          operationId,
          kind: normalized.kind,
          status: response.status,
          requestId: responseRequestId,
          attempt,
          durationMs: Date.now() - startedAt,
          actor: options.actor,
          appVersion: options.appVersion,
        });
        throw new ApiClientError(normalized);
      }

      if (!response.ok) {
        const normalized = normalizeHttpError({
          operationId,
          status: response.status,
          payload,
          responseRequestId,
          retryAfter: response.headers.get('retry-after'),
          method: contract.method,
          ...(requestOptions.allowedFieldErrors === undefined
            ? {}
            : { allowedFieldErrors: requestOptions.allowedFieldErrors }),
        });
        writeClientLog(options.logger, {
          phase: 'failure',
          operationId,
          kind: normalized.kind,
          code: normalized.code,
          status: normalized.status,
          requestId: normalized.requestId,
          attempt,
          durationMs: Date.now() - startedAt,
          actor: options.actor,
          appVersion: options.appVersion,
        });
        throw new ApiClientError(normalized);
      }

      writeClientLog(options.logger, {
        phase: 'success',
        operationId,
        status: response.status,
        requestId: responseRequestId,
        attempt,
        durationMs: Date.now() - startedAt,
        actor: options.actor,
        appVersion: options.appVersion,
      });

      return {
        data: payload,
        status: response.status,
        requestId: responseRequestId,
      };
    } catch (cause) {
      if (cause instanceof ApiClientError) {
        if (cause.normalized.operationId === 'unknown') {
          const normalized = {
            ...cause.normalized,
            operationId,
            requiresAuthoritativeRefresh:
              cause.normalized.requiresAuthoritativeRefresh || contract.method !== 'GET',
          };
          writeClientLog(options.logger, {
            phase: 'failure',
            operationId,
            kind: normalized.kind,
            requestId,
            attempt,
            durationMs: Date.now() - startedAt,
            actor: options.actor,
            appVersion: options.appVersion,
          });
          throw new ApiClientError(normalized, cause.causeValue);
        }
        throw cause;
      }

      const isMutation = contract.method !== 'GET';
      const normalized = createLocalError('TRANSPORT', operationId, isMutation);
      writeClientLog(options.logger, {
        phase: 'failure',
        operationId,
        kind: normalized.kind,
        requestId,
        attempt,
        durationMs: Date.now() - startedAt,
        actor: options.actor,
        appVersion: options.appVersion,
      });
      throw new ApiClientError(normalized, cause);
    }
  };

  return { request };
};

export const createApiClient = (options: ApiClientOptions): ApiClient => {
  const client = createClientForRegistry(options, OPENAPI_OPERATIONS, OPENAPI_SCHEMAS);

  return {
    request: <Id extends OperationId>(
      operationId: Id,
      input: OperationRequest<Id>,
      requestOptions?: RequestOptions,
    ): Promise<ApiClientResponse<OperationResponse<Id>>> =>
      client.request(operationId, input, requestOptions) as Promise<
        ApiClientResponse<OperationResponse<Id>>
      >,
  };
};

export const createApiClientForTesting = (
  options: ApiClientOptions,
  operations: OperationRegistry,
  schemas: SchemaRegistry,
): TestingApiClient => createClientForRegistry(options, operations, schemas);
