'use client';

/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/unbound-method */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import type {
  AdminMerchantSnapshot,
  AdminMutationInput,
  AdminOperationOutcome,
  AdminResult,
} from '../../../admin/admin-types';
import { useAdminRuntime } from '../../../auth/admin-runtime';
import {
  AccessDenied,
  Definition,
  DefinitionGrid,
  EmptyPanel,
  FailurePanel,
  LoadingPanel,
  OperationDialog,
  PageHeader,
  StaleNotice,
  StatusBadge,
  formatDateTime,
  useAdminResource,
} from '../../../components/admin-ui';

type MerchantAction = 'PAUSE' | 'SUSPEND' | 'RESTORE';

function wrapSnapshot(
  result: AdminResult<AdminMerchantSnapshot>,
): AdminResult<AdminOperationOutcome> {
  if (result.kind === 'FAILURE') return result;
  return {
    kind: 'SUCCESS',
    requestId: result.requestId,
    data: {
      replayed: false,
      summary: {
        profileStatus: result.data.merchant.profileStatus,
        onboardingStatus: result.data.merchant.onboardingStatus,
      },
    },
  };
}

export default function MerchantDetailPage() {
  const runtime = useAdminRuntime();
  const { merchantId } = useParams<{ merchantId: string }>();
  const resource = useAdminResource(
    () => runtime.port.merchant(merchantId),
    [runtime.port, merchantId],
  );
  const [action, setAction] = useState<MerchantAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!runtime.hasPermission('admin.merchants.read'))
    return <AccessDenied permission="admin.merchants.read" />;
  const submit = async (input: AdminMutationInput): Promise<AdminResult<AdminOperationOutcome>> => {
    if (action === 'PAUSE')
      return wrapSnapshot(await runtime.port.pauseMerchant(merchantId, input));
    if (action === 'SUSPEND')
      return wrapSnapshot(await runtime.port.suspendMerchant(merchantId, input));
    return wrapSnapshot(await runtime.port.restoreMerchant(merchantId, input));
  };
  const copy =
    action === null
      ? null
      : (
          {
            PAUSE: [
              'Pause merchant online orders',
              'Pauses eligible shop online ordering without deleting catalogue or KYC records.',
              'Pause orders',
            ],
            SUSPEND: [
              'Suspend merchant',
              'Suspends the merchant profile and operational shops according to backend state rules.',
              'Suspend merchant',
            ],
            RESTORE: [
              'Restore merchant',
              'Restores an eligible verified merchant to active operational state.',
              'Restore merchant',
            ],
          } as const
        )[action];
  return (
    <div className="page-stack">
      <PageHeader
        description="Privacy-minimal profile, shop readiness and pilot workload with permission-gated operational controls."
        eyebrow="Merchant operations"
        title={resource.data?.merchant.legalName ?? 'Loading merchant…'}
        actions={
          <>
            <Link className="text-action" href="/merchants">
              Back to merchants
            </Link>
            <button className="secondary-action" onClick={resource.reload} type="button">
              Refresh
            </button>
          </>
        }
      />
      {resource.loading && resource.data === null ? (
        <LoadingPanel label="Loading merchant operations…" />
      ) : null}
      {resource.failure !== null && resource.data === null ? (
        <FailurePanel failure={resource.failure} onRetry={resource.reload} />
      ) : null}
      {resource.stale ? <StaleNotice onRefresh={resource.reload} /> : null}
      {message === null ? null : (
        <div className="success-notice" role="status">
          {message}
        </div>
      )}
      {resource.data === null ? null : (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Current authoritative state</p>
                <h2>Merchant profile</h2>
              </div>
              <StatusBadge value={resource.data.merchant.profileStatus} />
            </div>
            <DefinitionGrid>
              <Definition label="Merchant ID">
                <code>{resource.data.merchant.id}</code>
              </Definition>
              <Definition label="Contact">
                ••••••{resource.data.merchant.phoneNumber.replace(/\D/gu, '').slice(-4)}
              </Definition>
              <Definition label="Onboarding">
                <StatusBadge value={resource.data.merchant.onboardingStatus} />
              </Definition>
              <Definition label="KYC">
                <StatusBadge value={resource.data.merchant.kycStatus} />
              </Definition>
              <Definition label="Open orders">{resource.data.metrics.openOrders}</Definition>
              <Definition label="Problem orders · 30d">
                {resource.data.metrics.problemOrders30d}
              </Definition>
              <Definition label="Cancelled · 30d">
                {resource.data.metrics.cancelledOrders30d}
              </Definition>
              <Definition label="Updated">
                {formatDateTime(resource.data.merchant.updatedAt)}
              </Definition>
            </DefinitionGrid>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">AAL2 · permission enforced</p>
                <h2>Operational controls</h2>
              </div>
            </div>
            {runtime.hasPermission('admin.merchants.manage') ? (
              <div className="action-grid">
                <button
                  className="secondary-action"
                  onClick={() => setAction('PAUSE')}
                  type="button"
                >
                  Pause online orders
                </button>
                <button
                  className="danger-action"
                  onClick={() => setAction('SUSPEND')}
                  type="button"
                >
                  Suspend merchant
                </button>
                <button
                  className="secondary-action"
                  onClick={() => setAction('RESTORE')}
                  type="button"
                >
                  Restore merchant
                </button>
              </div>
            ) : (
              <p className="permission-note">
                Read-only merchant access. Server mutations remain unavailable.
              </p>
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>Shops</h2>
            </div>
            {resource.data.shops.length === 0 ? (
              <EmptyPanel
                description="No active shop is linked to this merchant."
                title="No shops"
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Shop</th>
                      <th>Verification</th>
                      <th>Operational</th>
                      <th>Online orders</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.shops.map((shop) => (
                      <tr key={shop.id}>
                        <td>
                          <strong>{shop.name}</strong>
                          <small>{shop.shopCode}</small>
                        </td>
                        <td>
                          <StatusBadge value={shop.verificationStatus} />
                        </td>
                        <td>
                          <StatusBadge value={shop.operationalStatus} />
                        </td>
                        <td>{shop.acceptsOnlineOrders ? 'Accepted' : 'Paused'}</td>
                        <td>{formatDateTime(shop.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <Link
            className="text-action"
            href={`/audit?resourceType=MERCHANT&resourceId=${merchantId}`}
          >
            View merchant audit history
          </Link>
        </>
      )}
      {action === null || copy === null ? null : (
        <OperationDialog
          title={copy[0]}
          impact={copy[1]}
          confirmLabel={copy[2]}
          onClose={() => setAction(null)}
          onSubmit={submit}
          onCompleted={() => {
            setMessage('Merchant operation completed and authoritative state refreshed.');
            setAction(null);
            resource.reload();
          }}
        />
      )}
    </div>
  );
}
