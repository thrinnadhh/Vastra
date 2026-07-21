import type { ApiClientLogEvent, ApiClientLogger, ActorType, ApiErrorKind } from './types.js';

export type LogContext = Readonly<{
  phase: ApiClientLogEvent['phase'];
  operationId: string;
  kind?: ApiErrorKind | null;
  code?: string | null;
  status?: number | null;
  requestId?: string | null;
  attempt?: number;
  durationMs?: number;
  actor?: ActorType | null | undefined;
  appVersion?: string | null | undefined;
}>;

const boundedInteger = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) && value !== undefined ? Math.max(0, Math.trunc(value)) : fallback;

export const writeClientLog = (logger: ApiClientLogger | undefined, context: LogContext): void => {
  if (logger === undefined) {
    return;
  }

  const event: ApiClientLogEvent = {
    phase: context.phase,
    operationId: context.operationId,
    kind: context.kind ?? null,
    code: context.code ?? null,
    status: context.status ?? null,
    requestId: context.requestId ?? null,
    attempt: boundedInteger(context.attempt, 1),
    durationMs: boundedInteger(context.durationMs, 0),
    actor: context.actor ?? null,
    appVersion: context.appVersion ?? null,
  };

  logger.log(event);
};
