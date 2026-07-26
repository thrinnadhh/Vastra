import type { OperationResponse } from '@vastra/api-client';

export type AdminDashboardSummary = OperationResponse<'getAdminDashboard'>;
type AdminOrderListResponse = OperationResponse<'listAdminOperationalOrders'>;
export type AdminOperationalOrder = AdminOrderListResponse['orders'][number];

export type AdminOperationsState =
  | Readonly<{ kind: 'LOADING' }>
  | Readonly<{ kind: 'ACCESS_DENIED' }>
  | Readonly<{ kind: 'ERROR'; requestId: string | null }>
  | Readonly<{
      kind: 'READY';
      summary: AdminDashboardSummary;
      orders: readonly AdminOperationalOrder[];
      nextCursor: string | null;
      loadingMore: boolean;
    }>;

interface AdminOperationsViewProps {
  readonly state: AdminOperationsState;
  readonly statusFilter: string;
  readonly issueFilter: string;
  readonly onStatusFilterChange: (value: string) => void;
  readonly onIssueFilterChange: (value: string) => void;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
}

const ORDER_STATUSES = [
  'PAYMENT_PENDING',
  'WAITING_FOR_MERCHANT',
  'MERCHANT_ACCEPTED',
  'PACKING',
  'READY_FOR_PICKUP',
  'CAPTAIN_SEARCHING',
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_AT_STORE',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'CAPTAIN_AT_CUSTOMER',
  'DELIVERED',
  'COMPLETED',
  'PROBLEM_REPORTED',
  'CANCELLED',
] as const;

const ORDER_ISSUES = [
  'DELAYED',
  'UNASSIGNED',
  'MERCHANT_TIMEOUT',
  'CAPTAIN_ISSUE',
  'PAYMENT_ISSUE',
] as const;

const moneyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
});

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatMoney(paise: number): string {
  return moneyFormatter.format(paise / 100);
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? dateFormatter.format(timestamp) : 'Unavailable';
}

function LoadingState(): React.JSX.Element {
  return (
    <section aria-labelledby="operations-loading-title" className="operations-state">
      <p className="operations-state__eyebrow">Vastra operations</p>
      <h1 id="operations-loading-title">Loading live operations</h1>
      <p aria-live="polite" role="status">
        Checking the authoritative order and intervention queues.
      </p>
      <div aria-hidden="true" className="operations-skeleton-grid">
        <span />
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function ErrorState({
  denied,
  requestId,
  onRetry,
}: {
  readonly denied: boolean;
  readonly requestId: string | null;
  readonly onRetry: () => void;
}): React.JSX.Element {
  return (
    <section aria-labelledby="operations-error-title" className="operations-state" role="alert">
      <p className="operations-state__eyebrow">Vastra operations</p>
      <h1 id="operations-error-title">
        {denied ? 'Admin access denied' : 'Operations data is unavailable'}
      </h1>
      <p>
        {denied
          ? 'This signed-in account does not have permission to view the operations dashboard.'
          : 'The live queues could not be loaded. Your filters and secure session are preserved.'}
      </p>
      {requestId === null ? null : <p className="request-reference">Request ID: {requestId}</p>}
      {denied ? null : (
        <button className="operations-button" onClick={onRetry} type="button">
          Retry
        </button>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  urgent = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly urgent?: boolean;
}): React.JSX.Element {
  return (
    <article className={urgent ? 'metric-card metric-card--urgent' : 'metric-card'}>
      <p>{label}</p>
      <strong>{value.toLocaleString('en-IN')}</strong>
    </article>
  );
}

function OrderFilters({
  statusFilter,
  issueFilter,
  onStatusFilterChange,
  onIssueFilterChange,
}: Pick<
  AdminOperationsViewProps,
  'statusFilter' | 'issueFilter' | 'onStatusFilterChange' | 'onIssueFilterChange'
>): React.JSX.Element {
  return (
    <form
      aria-label="Live order filters"
      className="operations-filters"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <label>
        Order status
        <select
          aria-label="Order status"
          onChange={(event) => {
            onStatusFilterChange(event.target.value);
          }}
          value={statusFilter}
        >
          <option value="">All active statuses</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {humanize(status)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Intervention
        <select
          aria-label="Intervention"
          onChange={(event) => {
            onIssueFilterChange(event.target.value);
          }}
          value={issueFilter}
        >
          <option value="">All intervention states</option>
          {ORDER_ISSUES.map((issue) => (
            <option key={issue} value={issue}>
              {humanize(issue)}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}

function OrdersTable({ orders }: { readonly orders: readonly AdminOperationalOrder[] }) {
  return (
    <div className="operations-table-scroll">
      <table aria-label="Live operational orders" className="operations-table">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Customer and shop</th>
            <th scope="col">Status</th>
            <th scope="col">Payment</th>
            <th scope="col">Intervention</th>
            <th scope="col">Total</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <strong>{order.orderNumber}</strong>
                <span>{order.itemCount.toLocaleString('en-IN')} items</span>
              </td>
              <td>
                <strong>{order.customer.name ?? 'Customer name unavailable'}</strong>
                <span>{order.shop.name}</span>
              </td>
              <td>
                <span className="status-badge" data-status={order.status}>
                  {humanize(order.status)}
                </span>
                {order.deliveryStatus === null ? null : (
                  <span>{humanize(order.deliveryStatus)}</span>
                )}
              </td>
              <td>{humanize(order.paymentStatus)}</td>
              <td>
                {order.interventionReason === null ? (
                  <span className="muted-value">None</span>
                ) : (
                  <strong className="issue-value">{humanize(order.interventionReason)}</strong>
                )}
              </td>
              <td>{formatMoney(order.totalPaise)}</td>
              <td>
                <time dateTime={order.updatedAt}>{formatDate(order.updatedAt)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminOperationsView({
  state,
  statusFilter,
  issueFilter,
  onStatusFilterChange,
  onIssueFilterChange,
  onLoadMore,
  onRetry,
}: AdminOperationsViewProps): React.JSX.Element {
  if (state.kind === 'LOADING') return <LoadingState />;
  if (state.kind === 'ACCESS_DENIED') {
    return <ErrorState denied onRetry={onRetry} requestId={null} />;
  }
  if (state.kind === 'ERROR') {
    return <ErrorState denied={false} onRetry={onRetry} requestId={state.requestId} />;
  }

  return (
    <section aria-labelledby="operations-title" className="operations">
      <header className="operations-header">
        <div>
          <p className="operations-state__eyebrow">Tirupati control room</p>
          <h1 id="operations-title">Operations overview</h1>
          <p>
            Authoritative queue snapshot from{' '}
            <time dateTime={state.summary.generatedAt}>
              {formatDate(state.summary.generatedAt)}
            </time>
            .
          </p>
        </div>
        <button className="operations-button operations-button--secondary" onClick={onRetry}>
          Refresh
        </button>
      </header>

      <div aria-label="Operational metrics" className="metric-grid">
        <MetricCard label="Open orders" value={state.summary.openOrders} />
        <MetricCard label="Needs intervention" urgent value={state.summary.interventionOrders} />
        <MetricCard label="Searching deliveries" value={state.summary.searchingDeliveries} />
        <MetricCard label="Active deliveries" value={state.summary.activeDeliveries} />
        <MetricCard label="Open support cases" urgent value={state.summary.openCases} />
        <MetricCard
          label="Suspended accounts"
          value={state.summary.suspendedMerchants + state.summary.suspendedCaptains}
        />
      </div>

      <div className="orders-panel">
        <div className="orders-panel__heading">
          <div>
            <p className="operations-state__eyebrow">Live queue</p>
            <h2>Operational orders</h2>
          </div>
          <OrderFilters
            issueFilter={issueFilter}
            onIssueFilterChange={onIssueFilterChange}
            onStatusFilterChange={onStatusFilterChange}
            statusFilter={statusFilter}
          />
        </div>

        {state.orders.length === 0 ? (
          <div className="operations-empty" role="status">
            <h3>No orders match these filters</h3>
            <p>Change a filter or refresh the authoritative queue.</p>
          </div>
        ) : (
          <OrdersTable orders={state.orders} />
        )}

        {state.nextCursor === null ? null : (
          <div className="orders-panel__footer">
            <button
              className="operations-button operations-button--secondary"
              disabled={state.loadingMore}
              onClick={onLoadMore}
              type="button"
            >
              {state.loadingMore ? 'Loading more…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
