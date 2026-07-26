'use client';

/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-deprecated, @typescript-eslint/no-misused-promises, @typescript-eslint/unbound-method */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type { AdminSearchResult } from '../admin/admin-types';
import { useAdminRuntime } from '../auth/admin-runtime';
import {
  AccessDenied,
  EmptyPanel,
  FailurePanel,
  LoadingPanel,
  PageHeader,
  StaleNotice,
  StatusBadge,
  formatDateTime,
  useAdminResource,
} from '../components/admin-ui';

const COUNTERS = [
  ['Open orders', 'openOrders', '/orders'],
  ['Needs intervention', 'interventionOrders', '/orders?queue=PROBLEM'],
  ['Waiting for merchant', 'waitingMerchantOrders', '/orders?queue=WAITING'],
  ['Stuck orders', 'stuckOrders', '/orders?queue=STUCK'],
  ['Unassigned deliveries', 'unassignedDeliveries', '/orders?queue=UNASSIGNED'],
  ['Searching deliveries', 'searchingDeliveries', '/orders?queue=ACTIVE'],
  ['Active deliveries', 'activeDeliveries', '/orders?queue=ACTIVE'],
  ['Alert attention', 'alertAttention', '/orders?queue=ALERT'],
  ['Payment attention', 'paymentAttention', '/orders?queue=PAYMENT'],
  ['Refund attention', 'refundAttention', '/orders?queue=REFUND'],
  ['Open cases', 'openCases', '/orders?queue=CASE'],
] as const;

function resultHref(result: AdminSearchResult): string {
  if (result.type === 'ORDER') return `/orders/${result.id}`;
  if (result.type === 'MERCHANT') return `/merchants/${result.id}`;
  if (result.type === 'CAPTAIN') return `/captains/${result.id}`;
  if (result.type === 'DELIVERY_TASK') return `/orders?deliveryTaskId=${result.id}`;
  return `/audit?resourceType=CASE&resourceId=${result.id}`;
}

export default function AdminOperationsDashboard() {
  const runtime = useAdminRuntime();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<readonly AdminSearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const dashboard = useAdminResource(() => runtime.port.dashboard(), [runtime.port]);
  const orders = useAdminResource(
    () => runtime.port.orders({ queue: 'PROBLEM', limit: 8 }),
    [runtime.port],
  );

  if (!runtime.hasPermission('admin.dashboard.read')) {
    return <AccessDenied permission="admin.dashboard.read" />;
  }

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSearchError('Enter at least two characters or a supported identifier.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    const result = await runtime.port.search(normalized, 20);
    setSearching(false);
    if (result.kind === 'FAILURE') {
      setSearchError(result.failure.message);
      setSearchResults(null);
      return;
    }
    setSearchResults(result.data);
    const [onlyResult] = result.data;
    if (result.data.length === 1 && onlyResult !== undefined) {
      router.prefetch(resultHref(onlyResult));
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        description="Truthful operational queues from the authoritative backend. Counters are observation signals, not locally calculated metrics."
        eyebrow="FE08 · Observation and recovery"
        title="Operations overview"
        actions={
          <button
            className="secondary-action"
            onClick={() => {
              dashboard.reload();
              orders.reload();
            }}
            type="button"
          >
            Refresh all
          </button>
        }
      />

      <section aria-labelledby="admin-search-title" className="panel search-panel">
        <div>
          <p className="eyebrow">Global identifier search</p>
          <h2 id="admin-search-title">Find an order, delivery, merchant, captain or case</h2>
        </div>
        <form className="search-form" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="admin-search">
            Search operations
          </label>
          <input
            id="admin-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order number, UUID, phone suffix or name"
            value={query}
          />
          <button className="primary-action" disabled={searching} type="submit">
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchError === null ? null : (
          <p className="form-error" role="alert">
            {searchError}
          </p>
        )}
        {searchResults === null ? null : searchResults.length === 0 ? (
          <EmptyPanel
            description="Try a supported order number, UUID, name or phone suffix."
            title="No matching operational records"
          />
        ) : (
          <ul className="search-results" aria-label="Search results">
            {searchResults.map((result) => (
              <li key={`${result.type}:${result.id}`}>
                <Link href={resultHref(result)}>
                  <span>
                    <strong>{result.primaryText}</strong>
                    <small>{result.secondaryText}</small>
                  </span>
                  <span>
                    <StatusBadge value={result.status} />
                    <small>{formatDateTime(result.updatedAt)}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dashboard.loading && dashboard.data === null ? (
        <LoadingPanel label="Loading current operational counters…" />
      ) : null}
      {dashboard.failure !== null && dashboard.data === null ? (
        <FailurePanel failure={dashboard.failure} onRetry={dashboard.reload} />
      ) : null}
      {dashboard.stale ? <StaleNotice onRefresh={dashboard.reload} /> : null}
      {dashboard.data === null ? null : (
        <section aria-labelledby="dashboard-counters-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Generated {formatDateTime(dashboard.data.generatedAt)}</p>
              <h2 id="dashboard-counters-title">Live workload</h2>
            </div>
          </div>
          <div className="metric-grid">
            {COUNTERS.map(([label, key, href]) => (
              <Link className="metric-card" href={href} key={key}>
                <span>{label}</span>
                <strong>{dashboard.data?.[key] ?? 0}</strong>
                <small>Open queue</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="attention-orders-title" className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Prioritised queue</p>
            <h2 id="attention-orders-title">Orders requiring intervention</h2>
          </div>
          <Link className="text-action" href="/orders?queue=PROBLEM">
            View full queue
          </Link>
        </div>
        {orders.loading && orders.data === null ? (
          <LoadingPanel label="Loading intervention orders…" />
        ) : null}
        {orders.failure !== null && orders.data === null ? (
          <FailurePanel failure={orders.failure} onRetry={orders.reload} />
        ) : null}
        {orders.stale ? <StaleNotice onRefresh={orders.reload} /> : null}
        {orders.data?.orders.length === 0 ? (
          <EmptyPanel
            description="No orders currently match the problem queue."
            title="Intervention queue is clear"
          />
        ) : null}
        {orders.data === null || orders.data.orders.length === 0 ? null : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Shop</th>
                  <th>Status</th>
                  <th>Queue</th>
                  <th>Updated</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.data.orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber}</strong>
                      <small>
                        {order.customer.displayName} · ••••{order.customer.phoneLast4 ?? '—'}
                      </small>
                    </td>
                    <td>{order.shop.name}</td>
                    <td>
                      <StatusBadge value={order.orderStatus} />
                    </td>
                    <td>
                      <StatusBadge value={order.operationalQueue} />
                    </td>
                    <td>{formatDateTime(order.updatedAt)}</td>
                    <td>
                      <Link
                        aria-label={`Investigate ${order.orderNumber}`}
                        className="table-action"
                        href={`/orders/${order.id}`}
                      >
                        Investigate
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
