import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AdminOperationsView, type AdminOperationsState } from './admin-operations.view';

const noOp = (): void => undefined;

const readyState: AdminOperationsState = {
  kind: 'READY',
  summary: {
    openOrders: 14,
    interventionOrders: 3,
    searchingDeliveries: 2,
    activeDeliveries: 7,
    openCases: 4,
    suspendedMerchants: 1,
    suspendedCaptains: 0,
    generatedAt: '2026-07-26T12:00:00.000Z',
  },
  orders: [
    {
      id: 'd6f1c31b-d14d-4444-bce8-7c05c47d056e',
      orderNumber: 'VAS-260726-0042',
      status: 'CAPTAIN_SEARCHING',
      paymentStatus: 'CAPTURED',
      fulfilmentType: 'DELIVERY',
      totalPaise: 123_456,
      itemCount: 2,
      customer: {
        id: '6cf56a4d-d209-45f3-9b21-e198eba84c09',
        name: 'Customer',
        phoneNumber: null,
      },
      shop: {
        id: 'ce445d9b-8912-4772-af48-f2f67a70fef8',
        name: 'Tirupati Styles',
        merchantId: '9f87256c-1407-4278-acf4-74b2cc6f8ab2',
      },
      deliveryTaskId: null,
      deliveryStatus: 'SEARCHING',
      interventionReason: 'UNASSIGNED',
      estimatedDeliveryAt: '2026-07-26T12:25:00.000Z',
      placedAt: '2026-07-26T11:55:00.000Z',
      createdAt: '2026-07-26T11:55:00.000Z',
      updatedAt: '2026-07-26T12:02:00.000Z',
    },
  ],
  nextCursor: 'opaque-next-page',
  loadingMore: false,
};

function render(state: AdminOperationsState): string {
  return renderToStaticMarkup(
    <AdminOperationsView
      issueFilter=""
      onIssueFilterChange={noOp}
      onLoadMore={noOp}
      onRetry={noOp}
      onStatusFilterChange={noOp}
      state={state}
      statusFilter=""
    />,
  );
}

describe('AdminOperationsView', () => {
  it('renders a non-simulated loading state', () => {
    const markup = render({ kind: 'LOADING' });

    expect(markup).toContain('Loading live operations');
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('Open orders');
  });

  it('renders a recoverable error without exposing internal exception details', () => {
    const markup = render({
      kind: 'ERROR',
      requestId: '4b67a389-c4b2-4206-a966-b5fd2d70db04',
    });

    expect(markup).toContain('Operations data is unavailable');
    expect(markup).toContain('Request ID');
    expect(markup).toContain('Retry');
    expect(markup).not.toContain('stack');
  });

  it('renders authoritative metrics, filters, order context, and integer-paise money', () => {
    const markup = render(readyState);

    expect(markup).toContain('Operations overview');
    expect(markup).toContain('Open orders');
    expect(markup).toContain('14');
    expect(markup).toContain('VAS-260726-0042');
    expect(markup).toContain('Tirupati Styles');
    expect(markup).toContain('Unassigned');
    expect(markup).toContain('₹1,234.56');
    expect(markup).toContain('Load more');
    expect(markup).toContain('<table');
  });

  it('renders an explicit empty state for the active filters', () => {
    const markup = render({ ...readyState, orders: [], nextCursor: null });

    expect(markup).toContain('No orders match these filters');
    expect(markup).not.toContain('<table');
    expect(markup).not.toContain('Load more');
  });
});
