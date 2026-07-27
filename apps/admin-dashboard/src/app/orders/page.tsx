'use client';

/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-deprecated, @typescript-eslint/unbound-method */
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, type FormEvent } from 'react';

import type { AdminOperationalQueue, AdminOrderPage } from '../../admin/admin-types';
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
  formatInr,
  useAdminResource,
} from '../../components/admin-ui';

const QUEUES: readonly AdminOperationalQueue[] = [
  'ALL',
  'WAITING',
  'STUCK',
  'UNASSIGNED',
  'ACTIVE',
  'ALERT',
  'PAYMENT',
  'REFUND',
  'CASE',
  'PROBLEM',
];

function OrdersPageContent() {
  const runtime = useAdminRuntime();
  const params = useSearchParams();
  const initialQueue = QUEUES.includes(params.get('queue') as AdminOperationalQueue)
    ? (params.get('queue') as AdminOperationalQueue)
    : 'ALL';
  const [queue, setQueue] = useState<AdminOperationalQueue>(initialQueue);
  const [status, setStatus] = useState('');
  const [shopId, setShopId] = useState('');
  const [filters, setFilters] = useState({ queue: initialQueue, status: '', shopId: '' });
  const [appendedPages, setAppendedPages] = useState<readonly AdminOrderPage[]>([]);
  const resource = useAdminResource(
    () => runtime.port.orders({ ...filters, limit: 25 }),
    [runtime.port, filters.queue, filters.status, filters.shopId],
  );

  const visibleOrders = useMemo(() => {
    const previous = appendedPages.flatMap((page) => page.orders);
    const current = resource.data?.orders ?? [];
    const byId = new Map([...previous, ...current].map((order) => [order.id, order]));
    return [...byId.values()];
  }, [appendedPages, resource.data]);

  if (!runtime.hasPermission('admin.orders.read'))
    return <AccessDenied permission="admin.orders.read" />;

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppendedPages([]);
    setFilters({ queue, status: status.trim(), shopId: shopId.trim() });
  };

  const nextPage = async () => {
    const cursor = appendedPages.at(-1)?.nextCursor ?? resource.data?.nextCursor ?? null;
    if (cursor === null) return;
    const result = await runtime.port.orders({ ...filters, cursor, limit: 25 });
    if (result.kind === 'SUCCESS') {
      setAppendedPages((value) => [...value, result.data]);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        description="Server-filtered and cursor-paginated operational orders. Status and attention signals remain backend authoritative."
        eyebrow="Operations queue"
        title="Live orders"
        actions={
          <button className="secondary-action" onClick={resource.reload} type="button">
            Refresh
          </button>
        }
      />
      <form className="filter-bar" onSubmit={applyFilters}>
        <label>
          Queue
          <select
            onChange={(event) => setQueue(event.target.value as AdminOperationalQueue)}
            value={queue}
          >
            {QUEUES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Order status
          <input
            onChange={(event) => setStatus(event.target.value)}
            placeholder="e.g. CAPTAIN_SEARCHING"
            value={status}
          />
        </label>
        <label>
          Shop UUID
          <input
            onChange={(event) => setShopId(event.target.value)}
            placeholder="Optional exact shop ID"
            value={shopId}
          />
        </label>
        <button className="primary-action" type="submit">
          Apply filters
        </button>
      </form>
      {resource.loading && resource.data === null ? (
        <LoadingPanel label="Loading operational orders…" />
      ) : null}
      {resource.failure !== null && resource.data === null ? (
        <FailurePanel failure={resource.failure} onRetry={resource.reload} />
      ) : null}
      {resource.stale ? <StaleNotice onRefresh={resource.reload} /> : null}
      {!resource.loading && visibleOrders.length === 0 ? (
        <EmptyPanel
          description="Change the queue or filters, then retry."
          title="No matching operational orders"
        />
      ) : null}
      {visibleOrders.length === 0 ? null : (
        <section className="panel" aria-label="Operational orders">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Shop</th>
                  <th>Order</th>
                  <th>Payment</th>
                  <th>Delivery</th>
                  <th>Total</th>
                  <th>Updated</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber}</strong>
                      <small>
                        <StatusBadge value={order.operationalQueue} />
                      </small>
                    </td>
                    <td>
                      {order.customer.displayName}
                      <small>••••{order.customer.phoneLast4 ?? '—'}</small>
                    </td>
                    <td>{order.shop.name}</td>
                    <td>
                      <StatusBadge value={order.orderStatus} />
                    </td>
                    <td>
                      <StatusBadge value={order.paymentStatus} />
                    </td>
                    <td>
                      {order.delivery === null ? (
                        'Not created'
                      ) : (
                        <>
                          <StatusBadge value={order.delivery.status} />
                          <small>
                            {order.delivery.assignedCaptainId === null
                              ? 'Unassigned'
                              : 'Captain assigned'}
                          </small>
                        </>
                      )}
                    </td>
                    <td>{formatInr(order.totalPaise)}</td>
                    <td>{formatDateTime(order.updatedAt)}</td>
                    <td>
                      <Link className="table-action" href={`/orders/${order.id}`}>
                        Investigate
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(appendedPages.at(-1)?.nextCursor ?? resource.data?.nextCursor ?? null) === null ? (
            <p className="pagination-end">End of current results</p>
          ) : (
            <button className="secondary-action" onClick={() => void nextPage()} type="button">
              Load next page
            </button>
          )}
        </section>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Loading order filters…" />}>
      <OrdersPageContent />
    </Suspense>
  );
}
