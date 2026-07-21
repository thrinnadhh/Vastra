export type ApiErrorKind =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'TRANSPORT'
  | 'TIMEOUT'
  | 'API'
  | 'CONTRACT'
  | 'UNKNOWN';

export type NormalizedApiError = Readonly<{
  kind: ApiErrorKind;
  operationId: string;
  status: number | null;
  code: string | null;
  requestId: string | null;
  retryable: boolean;
  retryAfterMs: number | null;
  fieldErrors: Readonly<Record<string, readonly string[]>> | null;
  requiresAuthoritativeRefresh: boolean;
  userMessageKey: string;
}>;

export type ActorType = 'customer' | 'merchant' | 'captain' | 'admin';

export type AccessTokenProvider = Readonly<{
  getAccessToken: () => Promise<string | null> | string | null;
}>;

export type RequestIdProvider = () => string;

export type HeadersLike = Readonly<{
  get: (name: string) => string | null;
}>;

export type FetchResponseLike = Readonly<{
  ok: boolean;
  status: number;
  headers: HeadersLike;
  json: () => Promise<unknown>;
}>;

export type AbortSignalLike = Readonly<{
  readonly aborted: boolean;
  addEventListener?: (
    type: 'abort',
    listener: () => void,
    options?: Readonly<{ once?: boolean }>,
  ) => void;
  removeEventListener?: (type: 'abort', listener: () => void) => void;
}>;

export type FetchRequestInitLike = Readonly<{
  method: string;
  headers: Readonly<Record<string, string>>;
  body?: string;
  signal?: AbortSignalLike;
}>;

export type FetchLike = (url: string, init: FetchRequestInitLike) => Promise<FetchResponseLike>;

export type ApiClientLogEvent = Readonly<{
  phase: 'request' | 'success' | 'failure';
  operationId: string;
  kind: ApiErrorKind | null;
  code: string | null;
  status: number | null;
  requestId: string | null;
  attempt: number;
  durationMs: number;
  actor: ActorType | null;
  appVersion: string | null;
}>;

export type ApiClientLogger = Readonly<{
  log: (event: ApiClientLogEvent) => void;
}>;

export type ApiClientResponse<T> = Readonly<{
  data: T;
  status: number;
  requestId: string;
}>;
