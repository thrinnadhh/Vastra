'use client';

/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-deprecated, @typescript-eslint/unbound-method */
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

import { useAdminRuntime } from '../../auth/admin-runtime';
import {
  AccessDenied,
  EmptyPanel,
  FailurePanel,
  LoadingPanel,
  PageHeader,
  StaleNotice,
  StatusBadge,
  formatDateTime,
  humanize,
  useAdminResource,
} from '../../components/admin-ui';

function AuditPageContent() {
  const runtime = useAdminRuntime();
  const params = useSearchParams();
  const [resourceType, setResourceType] = useState(params.get('resourceType') ?? '');
  const [resourceId, setResourceId] = useState(params.get('resourceId') ?? '');
  const [actorId, setActorId] = useState('');
  const [filters, setFilters] = useState({ resourceType, resourceId, actorId });
  const resource = useAdminResource(
    () => runtime.port.audit({ ...filters, limit: 100 }),
    [runtime.port, filters.resourceType, filters.resourceId, filters.actorId],
  );
  if (!runtime.hasPermission('admin.audit.read'))
    return <AccessDenied permission="admin.audit.read" />;
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ resourceType, resourceId: resourceId.trim(), actorId: actorId.trim() });
  };
  return (
    <div className="page-stack">
      <PageHeader
        description="Immutable privileged-operation history. Filter by resource or actor without exposing secrets or raw authentication data."
        eyebrow="Governance"
        title="Admin audit"
        actions={
          <button className="secondary-action" onClick={resource.reload} type="button">
            Refresh
          </button>
        }
      />
      <form className="filter-bar" onSubmit={apply}>
        <label>
          Resource type
          <select onChange={(event) => setResourceType(event.target.value)} value={resourceType}>
            <option value="">Any</option>
            {['ORDER', 'DELIVERY_TASK', 'MERCHANT', 'CAPTAIN', 'CASE', 'CONFIGURATION'].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Resource UUID
          <input
            onChange={(event) => setResourceId(event.target.value)}
            placeholder="Optional exact resource ID"
            value={resourceId}
          />
        </label>
        <label>
          Actor UUID
          <input
            onChange={(event) => setActorId(event.target.value)}
            placeholder="Optional administrator ID"
            value={actorId}
          />
        </label>
        <button className="primary-action" type="submit">
          Apply filters
        </button>
      </form>
      {resource.loading && resource.data === null ? (
        <LoadingPanel label="Loading immutable audit entries…" />
      ) : null}
      {resource.failure !== null && resource.data === null ? (
        <FailurePanel failure={resource.failure} onRetry={resource.reload} />
      ) : null}
      {resource.stale ? <StaleNotice onRefresh={resource.reload} /> : null}
      {resource.data?.length === 0 ? (
        <EmptyPanel
          description="No audit entry matches the selected resource and actor filters."
          title="No matching audit entries"
        />
      ) : null}
      {resource.data === null || resource.data.length === 0 ? null : (
        <section className="panel">
          <ul className="audit-list">
            {resource.data.map((entry) => (
              <li key={entry.id}>
                <div className="audit-list__header">
                  <span>
                    <strong>{humanize(entry.action)}</strong>
                    <small>{formatDateTime(entry.createdAt)}</small>
                  </span>
                  <StatusBadge value={entry.reasonCode} />
                </div>
                <dl>
                  <div>
                    <dt>Resource</dt>
                    <dd>
                      {entry.resourceType} · <code>{entry.resourceId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Actor</dt>
                    <dd>
                      <code>{entry.actorId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Idempotency</dt>
                    <dd>
                      <code>{entry.idempotencyKey}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Request</dt>
                    <dd>{entry.requestId ?? 'Not supplied'}</dd>
                  </div>
                </dl>
                {entry.note === null ? null : <p>{entry.note}</p>}
                <details>
                  <summary>State change</summary>
                  <pre>{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre>
                </details>
                {entry.resourceType === 'ORDER' ? (
                  <Link className="text-action" href={`/orders/${entry.resourceId}`}>
                    Open order investigation
                  </Link>
                ) : entry.resourceType === 'MERCHANT' ? (
                  <Link className="text-action" href={`/merchants/${entry.resourceId}`}>
                    Open merchant
                  </Link>
                ) : entry.resourceType === 'CAPTAIN' ? (
                  <Link className="text-action" href={`/captains/${entry.resourceId}`}>
                    Open captain
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Loading audit filters…" />}>
      <AuditPageContent />
    </Suspense>
  );
}
