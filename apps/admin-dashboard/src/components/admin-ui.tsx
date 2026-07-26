'use client';

/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-deprecated, @typescript-eslint/no-misused-promises */
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { createIdempotencyKey } from '../admin/admin-api';
import {
  ADMIN_REASON_CODES,
  type AdminFailure,
  type AdminMutationInput,
  type AdminOperationOutcome,
  type AdminReasonCode,
  type AdminResult,
} from '../admin/admin-types';

export function formatInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
}

export function formatDateTime(value: string | null): string {
  if (value === null) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Invalid timestamp';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function StatusBadge({ value }: { readonly value: string }) {
  const normalized = value.toLowerCase();
  const tone = /complete|delivered|active|verified|available|success/u.test(normalized)
    ? 'success'
    : /cancel|suspend|reject|failed|problem|blocked|danger/u.test(normalized)
      ? 'danger'
      : /pending|waiting|search|offered|review|attention|pause/u.test(normalized)
        ? 'warning'
        : 'neutral';
  return <span className={`status-badge status-badge--${tone}`}>{humanize(value)}</span>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions === undefined ? null : <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function AccessDenied({ permission }: { readonly permission: string }) {
  return (
    <section
      aria-labelledby="access-denied-title"
      className="state-panel state-panel--danger"
      role="alert"
    >
      <p className="eyebrow">Permission required</p>
      <h1 id="access-denied-title">This section is not available</h1>
      <p>
        Your current administrator permissions do not include <code>{permission}</code>. The server
        will also deny direct requests.
      </p>
      <Link className="secondary-action" href="/">
        Return to overview
      </Link>
    </section>
  );
}

export function FailurePanel({
  failure,
  onRetry,
}: {
  readonly failure: AdminFailure;
  readonly onRetry?: () => void;
}) {
  return (
    <section className="state-panel state-panel--danger" role="alert">
      <h2>{humanize(failure.kind)}</h2>
      <p>{failure.message}</p>
      {failure.requestId === null ? null : (
        <p className="request-id">Request ID: {failure.requestId}</p>
      )}
      {onRetry === undefined ? null : (
        <button className="secondary-action" onClick={onRetry} type="button">
          Retry
        </button>
      )}
    </section>
  );
}

export function LoadingPanel({ label }: { readonly label: string }) {
  return (
    <section aria-busy="true" className="state-panel" role="status">
      <div className="loading-bar" />
      <p>{label}</p>
    </section>
  );
}

export function EmptyPanel({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <section className="state-panel">
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

export interface AdminResourceState<T> {
  readonly data: T | null;
  readonly failure: AdminFailure | null;
  readonly loading: boolean;
  readonly stale: boolean;
  reload(): void;
  setData(data: T): void;
}

export function useAdminResource<T>(
  loader: () => Promise<AdminResult<T>>,
  dependencies: readonly unknown[],
): AdminResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const active = useRef(0);
  const loaderRef = useRef(loader);
  const dependencyKey = dependencies
    .map((dependency, index) => `${String(index)}:${typeof dependency}:${String(dependency)}`)
    .join('|');
  const requestKey = `${dependencyKey}:${String(reloadToken)}`;

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    const operation = ++active.current;
    void Promise.resolve(requestKey).then(async () => {
      setLoading(true);
      setFailure(null);
      const result = await loaderRef.current();
      if (active.current !== operation) return;
      setLoading(false);
      if (result.kind === 'SUCCESS') {
        setData(result.data);
      } else {
        setFailure(result.failure);
        if (!result.failure.requiresRefresh) setData(null);
      }
    });
    return () => {
      active.current += 1;
    };
  }, [requestKey]);

  return {
    data,
    failure,
    loading,
    stale: data !== null && failure !== null,
    reload: () => setReloadToken((value) => value + 1),
    setData,
  };
}

export function StaleNotice({ onRefresh }: { readonly onRefresh: () => void }) {
  return (
    <div className="stale-notice" role="status">
      <span>Displayed data may be stale.</span>
      <button className="text-action" onClick={onRefresh} type="button">
        Refresh authoritative state
      </button>
    </div>
  );
}

export function DefinitionGrid({ children }: { readonly children: ReactNode }) {
  return <dl className="definition-grid">{children}</dl>;
}

export function Definition({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function OperationDialog({
  title,
  impact,
  confirmLabel,
  onClose,
  onSubmit,
  onCompleted,
  extraFields,
}: {
  readonly title: string;
  readonly impact: string;
  readonly confirmLabel: string;
  readonly onClose: () => void;
  readonly onSubmit: (input: AdminMutationInput) => Promise<AdminResult<AdminOperationOutcome>>;
  readonly onCompleted: (outcome: AdminOperationOutcome) => void;
  readonly extraFields?: ReactNode;
}) {
  const [reasonCode, setReasonCode] = useState<AdminReasonCode>('OPERATIONAL_RECOVERY');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const idempotencyKey = useRef(createIdempotencyKey());
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    globalThis.addEventListener('keydown', handleKey);
    return () => globalThis.removeEventListener('keydown', handleKey);
  }, [busy, onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedNote = note.trim();
    if (reasonCode === 'OTHER' && normalizedNote.length === 0) {
      setFailure({
        kind: 'VALIDATION',
        message: 'A note is required when the reason is Other.',
        requestId: null,
        requiresRefresh: false,
      });
      return;
    }
    setBusy(true);
    setFailure(null);
    const result = await onSubmit({
      reasonCode,
      note: normalizedNote.length === 0 ? null : normalizedNote,
      idempotencyKey: idempotencyKey.current,
    });
    setBusy(false);
    if (result.kind === 'FAILURE') {
      setFailure(result.failure);
      if (result.failure.kind === 'VALIDATION') idempotencyKey.current = createIdempotencyKey();
      return;
    }
    onCompleted(result.data);
  };

  return (
    <div className="dialog-backdrop">
      <dialog
        aria-labelledby="operation-dialog-title"
        className="operation-dialog"
        open
        ref={dialog}
        tabIndex={-1}
      >
        <form onSubmit={submit}>
          <p className="eyebrow">Privileged recovery</p>
          <h2 id="operation-dialog-title">{title}</h2>
          <div className="impact-panel">
            <strong>Expected impact</strong>
            <p>{impact}</p>
          </div>
          {extraFields}
          <label>
            Operational reason
            <select
              disabled={busy}
              onChange={(event) => setReasonCode(event.target.value as AdminReasonCode)}
              value={reasonCode}
            >
              {ADMIN_REASON_CODES.map((reason) => (
                <option key={reason} value={reason}>
                  {humanize(reason)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Operational note {reasonCode === 'OTHER' ? '(required)' : '(optional)'}
            <textarea
              disabled={busy}
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              value={note}
            />
          </label>
          <p className="idempotency-note">
            Duplicate submissions reuse one idempotency identity until the server returns an
            authoritative outcome.
          </p>
          {failure === null ? null : <FailurePanel failure={failure} />}
          <div className="dialog-actions">
            <button className="secondary-action" disabled={busy} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="danger-action" disabled={busy} type="submit">
              {busy ? 'Applying…' : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
