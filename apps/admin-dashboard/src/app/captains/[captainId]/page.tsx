'use client';

/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/unbound-method */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import type {
  AdminCaptainSnapshot,
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
  formatInr,
  useAdminResource,
} from '../../../components/admin-ui';

type CaptainAction = 'SUSPEND' | 'RESTORE' | 'RELEASE' | 'OFFLINE' | 'AVAILABLE' | 'ON_BREAK';

function wrapSnapshot(
  result: AdminResult<AdminCaptainSnapshot>,
): AdminResult<AdminOperationOutcome> {
  if (result.kind === 'FAILURE') return result;
  return {
    kind: 'SUCCESS',
    requestId: result.requestId,
    data: {
      replayed: false,
      summary: {
        profileStatus: result.data.captain.profileStatus,
        availabilityStatus: result.data.captain.availabilityStatus,
      },
    },
  };
}

export default function CaptainDetailPage() {
  const runtime = useAdminRuntime();
  const { captainId } = useParams<{ captainId: string }>();
  const resource = useAdminResource(
    () => runtime.port.captain(captainId),
    [runtime.port, captainId],
  );
  const [action, setAction] = useState<CaptainAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!runtime.hasPermission('admin.captains.read'))
    return <AccessDenied permission="admin.captains.read" />;
  const submit = async (input: AdminMutationInput): Promise<AdminResult<AdminOperationOutcome>> => {
    if (action === 'SUSPEND')
      return wrapSnapshot(await runtime.port.suspendCaptain(captainId, input));
    if (action === 'RESTORE')
      return wrapSnapshot(await runtime.port.restoreCaptain(captainId, input));
    if (action === 'RELEASE')
      return wrapSnapshot(await runtime.port.releaseCaptainAssignment(captainId, input));
    const target =
      action === 'AVAILABLE' ? 'AVAILABLE' : action === 'ON_BREAK' ? 'ON_BREAK' : 'OFFLINE';
    return wrapSnapshot(await runtime.port.correctCaptainAvailability(captainId, target, input));
  };
  const copy =
    action === null
      ? null
      : (
          {
            SUSPEND: [
              'Suspend captain',
              'Suspends an eligible captain. A pre-pickup assignment may be released by the backend; post-pickup custody remains protected.',
              'Suspend captain',
            ],
            RESTORE: [
              'Restore captain',
              'Restores an eligible verified captain to active profile status and offline availability.',
              'Restore captain',
            ],
            RELEASE: [
              'Release active assignment',
              'Releases only an eligible pre-pickup assignment and returns the task to server-managed captain search.',
              'Release assignment',
            ],
            OFFLINE: [
              'Set captain offline',
              'Corrects availability only when the captain has no active delivery and remains otherwise eligible.',
              'Set offline',
            ],
            AVAILABLE: [
              'Set captain available',
              'Corrects availability only when the captain has no active delivery and remains otherwise eligible.',
              'Set available',
            ],
            ON_BREAK: [
              'Set captain on break',
              'Corrects availability only when the captain has no active delivery and remains otherwise eligible.',
              'Set on break',
            ],
          } as const
        )[action];
  return (
    <div className="page-stack">
      <PageHeader
        description="Privacy-minimal profile, live assignment, location freshness and audited operational controls."
        eyebrow="Captain operations"
        title={resource.data?.captain.fullName ?? 'Loading captain…'}
        actions={
          <>
            <Link className="text-action" href="/captains">
              Back to captains
            </Link>
            <button className="secondary-action" onClick={resource.reload} type="button">
              Refresh
            </button>
          </>
        }
      />
      {resource.loading && resource.data === null ? (
        <LoadingPanel label="Loading captain operations…" />
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
                <h2>Captain profile</h2>
              </div>
              <StatusBadge value={resource.data.captain.availabilityStatus} />
            </div>
            <DefinitionGrid>
              <Definition label="Captain ID">
                <code>{resource.data.captain.id}</code>
              </Definition>
              <Definition label="Captain code">{resource.data.captain.captainCode}</Definition>
              <Definition label="Contact">
                ••••••{resource.data.captain.phoneNumber.replace(/\D/gu, '').slice(-4)}
              </Definition>
              <Definition label="Profile">
                <StatusBadge value={resource.data.captain.profileStatus} />
              </Definition>
              <Definition label="KYC">
                <StatusBadge value={resource.data.captain.kycStatus} />
              </Definition>
              <Definition label="Vehicle">
                {resource.data.captain.vehicleType ?? 'Not recorded'} ·{' '}
                {resource.data.captain.vehicleNumber ?? 'No number'}
              </Definition>
              <Definition label="Rating">
                {resource.data.captain.ratingAverage?.toFixed(1) ?? '—'} (
                {resource.data.captain.ratingCount})
              </Definition>
              <Definition label="Completed deliveries">
                {resource.data.captain.completedDeliveries}
              </Definition>
              <Definition label="Cash balance">
                {formatInr(resource.data.captain.cashBalancePaise)}
              </Definition>
              <Definition label="Pending earnings">
                {formatInr(resource.data.metrics.pendingEarningsPaise)}
              </Definition>
              <Definition label="Problems · 30d">
                {resource.data.metrics.problemDeliveries30d}
              </Definition>
              <Definition label="Updated">
                {formatDateTime(resource.data.captain.updatedAt)}
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
            {runtime.hasPermission('admin.captains.manage') ? (
              <div className="action-grid">
                <button
                  className="danger-action"
                  onClick={() => setAction('SUSPEND')}
                  type="button"
                >
                  Suspend captain
                </button>
                <button
                  className="secondary-action"
                  onClick={() => setAction('RESTORE')}
                  type="button"
                >
                  Restore captain
                </button>
                {resource.data.activeDelivery === null ? (
                  <>
                    <button
                      className="secondary-action"
                      onClick={() => setAction('AVAILABLE')}
                      type="button"
                    >
                      Set available
                    </button>
                    <button
                      className="secondary-action"
                      onClick={() => setAction('OFFLINE')}
                      type="button"
                    >
                      Set offline
                    </button>
                    <button
                      className="secondary-action"
                      onClick={() => setAction('ON_BREAK')}
                      type="button"
                    >
                      Set on break
                    </button>
                  </>
                ) : (
                  <button
                    className="danger-action"
                    onClick={() => setAction('RELEASE')}
                    type="button"
                  >
                    Release active assignment
                  </button>
                )}
              </div>
            ) : (
              <p className="permission-note">
                Read-only captain access. Server mutations remain unavailable.
              </p>
            )}
          </section>
          <div className="two-column">
            <section className="panel">
              <div className="section-heading">
                <h2>Active delivery</h2>
              </div>
              {resource.data.activeDelivery === null ? (
                <EmptyPanel
                  description="No active delivery is assigned to this captain."
                  title="No active task"
                />
              ) : (
                <DefinitionGrid>
                  <Definition label="Task ID">
                    <code>{resource.data.activeDelivery.taskId}</code>
                  </Definition>
                  <Definition label="Order">
                    <Link href={`/orders/${resource.data.activeDelivery.orderId}`}>
                      {resource.data.activeDelivery.orderId}
                    </Link>
                  </Definition>
                  <Definition label="Status">
                    <StatusBadge value={resource.data.activeDelivery.status} />
                  </Definition>
                  <Definition label="Assigned">
                    {formatDateTime(resource.data.activeDelivery.assignedAt)}
                  </Definition>
                  <Definition label="Picked up">
                    {formatDateTime(resource.data.activeDelivery.pickedUpAt)}
                  </Definition>
                  <Definition label="Problem reported">
                    {formatDateTime(resource.data.activeDelivery.problemReportedAt)}
                  </Definition>
                </DefinitionGrid>
              )}
            </section>
            <section className="panel">
              <div className="section-heading">
                <h2>Last known location</h2>
              </div>
              {resource.data.location === null ? (
                <EmptyPanel
                  description="No current location projection is available."
                  title="Location unavailable"
                />
              ) : (
                <DefinitionGrid>
                  <Definition label="Coordinates">
                    {resource.data.location.latitude.toFixed(5)},{' '}
                    {resource.data.location.longitude.toFixed(5)}
                  </Definition>
                  <Definition label="Accuracy">
                    ±{resource.data.location.accuracyMeters.toFixed(0)} m
                  </Definition>
                  <Definition label="Recorded">
                    {formatDateTime(resource.data.location.recordedAt)}
                  </Definition>
                  <Definition label="Active task">
                    {resource.data.location.activeDeliveryTaskId ?? 'None'}
                  </Definition>
                </DefinitionGrid>
              )}
            </section>
          </div>
          <Link
            className="text-action"
            href={`/audit?resourceType=CAPTAIN&resourceId=${captainId}`}
          >
            View captain audit history
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
            setMessage('Captain operation completed and authoritative state refreshed.');
            setAction(null);
            resource.reload();
          }}
        />
      )}
    </div>
  );
}
