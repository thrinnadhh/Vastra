import {
  OPENAPI_OPERATIONS,
  OPENAPI_SCHEMAS,
  type OperationId,
  type OperationRequest,
  type OperationResponse,
} from './generated/openapi';
import { ApiClientError, createLocalError, normalizeHttpError } from './errors';
import { writeClientLog } from './logging';
import { validateJsonSchema, type JsonSchema, type SchemaRegistry } from './schema';
import type {
  AbortSignalLike,
  AccessTokenProvider,
  ActorType,
  ApiClientLogger,
  ApiClientResponse,
  FetchLike,
  FetchRequestInitLike,
  RequestIdProvider,
} from './types';

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
  actor?: ActorType | null;
  appVersion?: string | null;
  defaultTimeoutMs?: number;
}>;

export type RequestOptions = Readonly<{
  signal?: AbortSignalLike;
  timeoutMs?: number;
  attempt?: number;
  allowedFieldErrors?: readonly string[];
}>;

export type ApiClient = Readonly<{
  request: <Id extends OperationId>(
    operationId: Id,
    input: OperationRequest<Id>,
    requestOptions?: RequestOptions,
  ) => Promise<ApiClientResponse<OperationResponse<Id>>>;
}>;

type TestingApiClient = Readonly<{
  request: (
    operationId: string,
    input: unknown,
    requestOptions?: RequestOptions,
  ) => Promise<ApiClientResponse<unknown>>;
}>;

const defaultRequestIdProvider: RequestIdProvider = () => globalThis.crypto.randomUUID();

const asInputRecord = (input: unknown): Readonly<Record<string, unknown>> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Readonly<Record<string, unknown>>)
    : {};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const encodePathValue = (value: unknown): string => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new ApiClientError(createLocalError('CONTRACT', 'unknown'));
  }
  return encodeURIComponent(String(value));
};

const buildPath = (template: string, pathInput: unknown): string => {
  const path = isRecord(pathInput) ? pathInput : {};
  return template.replace(/\{([^}]+)\}/gu, (_match, key: string) => encodePathValue(path[key]));
};

const buildQuery = (queryInput: unknown): string => {
  if (!isRecord(queryInput)) {
    return '';
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryInput)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }
      continue;
    }
    params.append(key, String(value));
  }
  const serialized = params.toString();
  return serialized.length === 0 ? '' : `?${serialized}`;
};

const decodePayload = async (response: Awaited<ReturnType<FetchLike>>): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw new ApiClientError(createLocalError('CONTRACT', 'unknown'));
  }
};

const requestIdFromPayload = (payload: unknown): string | null => {
  if (!isRecord(payload)) {
    return null;
  }
  const requestId = payload['requestId'];
  return typeof requestId === 'string' ? requestId : null;
};

const schemaForStatus = (contract: OperationRuntimeContract, status: number): JsonSchema | null =>
  contract.responses[String(status)] ?? contract.responses['default'] ?? null;

const globalRuntime = globalThis as typeof globalThis & {
  setTimeout: (handler: () => void, timeoutMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const withTimeout = async <T>(
  execute: (signal: AbortSignalLike | undefined) => Promise<T>,
  timeoutMs: number,
  externalSignal?: AbortSignalLike,
): Promise<T> => {
  const AbortControllerConstructor = globalThis.AbortController;
  const controller =
    typeof AbortControllerConstructor === 'function' ? new AbortControllerConstructor() : null;
  let timeoutHandle: unknown;
  const abortFromExternal = (): void => controller?.abort();
  try {
    if (externalSignal?.aborted === true) {
      controller?.abort();
    } else {
      externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });
    }
    timeoutHandle = globalRuntime.setTimeout(() => controller?.abort(), timeoutMs);
    return await execute(controller?.signal as AbortSignalLike | undefined);
  } catch (cause) {
    if (controller?.signal.aborted === true && externalSignal?.aborted !== true) {
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
      client.request(operationId, input, requestOptions),
  };
};

export const createApiClientForTesting = (
  options: ApiClientOptions,
  operations: OperationRegistry,
  schemas: SchemaRegistry,
): TestingApiClient => createClientForRegistry(options, operations, schemas);
