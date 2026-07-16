import { randomUUID } from 'node:crypto';

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type LoggerService,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const REQUEST_ID_HEADER = 'x-request-id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface RequestWithId {
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly method: string;
  readonly path?: string;
  readonly url: string;
  requestId?: string;
}

interface ResponseWithId {
  readonly statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', listener: () => void): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequestIdHeader(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
): string | undefined {
  const value = headers[REQUEST_ID_HEADER];
  return typeof value === 'string' ? value.trim() : undefined;
}

export function resolveRequestId(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
): string {
  const candidate = readRequestIdHeader(headers);
  return candidate !== undefined && UUID_PATTERN.test(candidate)
    ? candidate.toLowerCase()
    : randomUUID();
}

export function attachRequestIdToPayload(payload: unknown, requestId: string): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  const nextPayload: Record<string, unknown> = { ...payload };

  if (Object.hasOwn(nextPayload, 'requestId')) {
    nextPayload['requestId'] = requestId;
  }

  const meta = nextPayload['meta'];

  if (isRecord(meta) && Object.hasOwn(meta, 'requestId')) {
    nextPayload['meta'] = { ...meta, requestId };
  }

  return nextPayload;
}

export function createRequestContextMiddleware(logger: LoggerService) {
  return (request: RequestWithId, response: ResponseWithId, next: () => void): void => {
    const startedAt = process.hrtime.bigint();
    const requestId = resolveRequestId(request.headers);
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    response.on('finish', () => {
      const durationMilliseconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      logger.log({
        event: 'http.request.completed',
        requestId,
        method: request.method,
        path: request.path ?? request.url.split('?')[0] ?? '/',
        statusCode: response.statusCode,
        durationMilliseconds: Number(durationMilliseconds.toFixed(2)),
      });
    });

    next();
  };
}

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const requestId = request.requestId ?? resolveRequestId(request.headers);

    return next
      .handle()
      .pipe(map((payload: unknown) => attachRequestIdToPayload(payload, requestId)));
  }
}
