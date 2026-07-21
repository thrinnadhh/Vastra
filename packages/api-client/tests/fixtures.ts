import type { ApiClientOptions, OperationRegistry } from '../src/client.js';
import type { SchemaRegistry } from '../src/schema.js';
import type { FetchRequestInitLike, FetchResponseLike } from '../src/types.js';

export const TEST_SCHEMAS: SchemaRegistry = {
  ApiError: {
    type: 'object',
    required: ['success', 'error'],
    properties: {
      success: { const: false },
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          retryable: { type: 'boolean' },
          details: { type: ['object', 'null'] },
        },
      },
      requestId: { type: ['string', 'null'] },
    },
  },
  Success: {
    type: 'object',
    required: ['success', 'data', 'meta'],
    properties: {
      success: { const: true },
      data: { type: 'object' },
      meta: {
        type: 'object',
        required: ['requestId'],
        properties: { requestId: { type: ['string', 'null'] } },
      },
    },
  },
};

export const TEST_OPERATIONS: OperationRegistry = {
  getWidget: {
    method: 'GET',
    path: '/widgets/{widgetId}',
    requiresAuth: true,
    responses: {
      '200': { $ref: '#/components/schemas/Success' },
      '400': { $ref: '#/components/schemas/ApiError' },
      '401': { $ref: '#/components/schemas/ApiError' },
      '403': { $ref: '#/components/schemas/ApiError' },
      '404': { $ref: '#/components/schemas/ApiError' },
      '409': { $ref: '#/components/schemas/ApiError' },
      '422': { $ref: '#/components/schemas/ApiError' },
      '429': { $ref: '#/components/schemas/ApiError' },
      default: { $ref: '#/components/schemas/ApiError' },
    },
  },
  updateWidget: {
    method: 'POST',
    path: '/widgets/{widgetId}',
    requiresAuth: true,
    responses: {
      '200': { $ref: '#/components/schemas/Success' },
      default: { $ref: '#/components/schemas/ApiError' },
    },
  },
  publicWidget: {
    method: 'GET',
    path: '/public/widgets',
    requiresAuth: false,
    responses: { '200': { $ref: '#/components/schemas/Success' } },
  },
};

export const successPayload = (requestId = 'response-request-id') => ({
  success: true,
  data: { id: 'widget-1' },
  meta: { requestId },
});

export const errorPayload = (
  code = 'TEST_ERROR',
  options: Readonly<{
    retryable?: boolean;
    requestId?: string;
    details?: Readonly<Record<string, unknown>>;
  }> = {},
) => ({
  success: false,
  error: {
    code,
    message: 'unsafe server message',
    retryable: options.retryable ?? false,
    details: options.details ?? null,
  },
  requestId: options.requestId ?? 'error-request-id',
});

export const response = (
  status: number,
  payload: unknown,
  headers: Readonly<Record<string, string>> = {},
): FetchResponseLike => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    get: (name) => headers[name.toLowerCase()] ?? null,
  },
  json: async () => payload,
});

export const clientOptions = (
  fetch: (url: string, init: FetchRequestInitLike) => Promise<FetchResponseLike>,
  overrides: Partial<ApiClientOptions> = {},
): ApiClientOptions => ({
  baseUrl: 'https://api.example.test/v1/',
  fetch,
  accessTokenProvider: { getAccessToken: () => 'access-token' },
  requestIdProvider: () => 'client-request-id',
  ...overrides,
});
