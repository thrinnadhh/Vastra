'use client';

/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/unbound-method */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import type {
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
  humanize,
  useAdminResource,
} from '../../../components/admin-ui';

type Operation =
  | 'CANCEL'
  | 'RETRY_DISPATCH'
  | 'RELEASE_DELIVERY'
  | 'RESET_PICKUP'
  | 'RESET_OTP'
  | 'ASSIGN_CAPTAIN';

function maskPhone(value: string): string {
  const digits = value.replace(/\D/gu, '');
  return digits.length < 4 ? 'Masked' : `••••••${digits.slice(-4)}`;
}

export default function OrderInvestigationPage() {
  const runtime = useAdminRuntime();
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const resource = useAdminResource(() => runtime.port.order(orderId), [runtime.port, orderId]);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [captainId, setCaptainId] = useState('');
  const [outcome, setOutcome] = useState<AdminOperationOutcome | null>(null);

  if (!runtime.hasPermission('admin.orders.read'))
    return <AccessDenied permission="admin.orders.read" />;

  const manage = runtime.hasPermission('admin.orders.manage');
  const investigation = resource.data;
  const delivery = investigation?.delivery ?? null;

  const submitOperation = (
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminOperationOutcome>> => {
    if (operation === 'CANCEL') return runtime.port.cancelOrder(orderId, input);
    if (operation === 'RETRY_DISPATCH') return runtime.port.retryDispatch(orderId, input);
    if (operation === 'RELEASE_DELIVERY' && delivery !== null)
      return runtime.port.releaseDelivery(delivery.taskId, input);
    if (operation === 'RESET_PICKUP' && delivery !== null)
      return runtime.port.resetVerification(delivery.taskId, 'PICKUP_CODE', input);
    if (operation === 'RESET_OTP' && delivery !== null)
      return runtime.port.resetVerification(delivery.taskId, 'DELIVERY_OTP', input);
    if (operation === 'ASSIGN_CAPTAIN' && delivery !== null)
      return runtime.port.assignCaptain(delivery.taskId, captainId.trim(), input.idempotencyKey);
    return Promise.resolve({
      kind: 'FAILURE',
      failure: {
        kind: 'VALIDATION',
        message: 'This recovery action is not available for the current server state.',
        requestId: null,
        requiresRefresh: true,
      },
    });
  };

  const dialogCopy =
    operation === null
      ? null
      : (
          {
            CANCEL: [
              'Cancel this order',
              'Cancels an eligible pre-pickup order, releases active delivery assignment and records an immutable audit event.',
              'Confirm cancellation',
            ],
            RETRY_DISPATCH: [
              'Restart captain search',
              'Releases an eligible assignment, returns the delivery task to searching and refreshes the authoritative order state.',
              'Restart dispatch',
            ],
            RELEASE_DELIVERY: [
              'Release delivery assignment',
              'Releases the current captain before pickup and returns the task to the server-managed search queue.',
              'Release assignment',
            ],
            RESET_PICKUP: [
              'Reset pickup verification',
              'Clears pickup-code verification state without exposing or generating a secret. An authorised reissue is required.',
              'Reset pickup verification',
            ],
            RESET_OTP: [
              'Reset delivery verification',
              'Clears delivery-OTP verification state without exposing or generating a secret. An authorised reissue is required.',
              'Reset delivery verification',
            ],
            ASSIGN_CAPTAIN: [
              'Assign a captain',
              'Attempts a server-authoritative assignment to the specified captain. Eligibility, active-task exclusivity and state checks remain enforced by the backend.',
              'Assign captain',
            ],
          } as const
        )[operation];

  return (
    <div className="page-stack">
      <PageHeader
        description="Complete server timeline, linked operational actors and audited recovery controls. Refresh after any race or uncertain result."
        eyebrow="Order investigation"
        title={investigation === null ? 'Loading order…' : investigation.order.orderNumber}
        actions={
          <>
            <Link className="text-action" href="/orders">
              Back to orders
            </Link>
            <button className="secondary-action" onClick={resource.reload} type="button">
              Refresh
            </button>
          </>
        }
      />
      {resource.loading && investigation === null ? (
        <LoadingPanel label="Loading order investigation…" />
      ) : null}
      {resource.failure !== null && investigation === null ? (
        <FailurePanel failure={resource.failure} onRetry={resource.reload} />
      ) : null}
      {resource.stale ? <StaleNotice onRefresh={resource.reload} /> : null}
      {outcome === null ? null : (
        <div className="success-notice" role="status">
          <strong>Authoritative operation completed.</strong>
          <span>
            {outcome.replayed
              ? 'The server returned the original idempotent result.'
              : 'A new audited result was recorded.'}
          </span>
        </div>
      )}
      {investigation === null ? null : (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Current authoritative state</p>
                <h2>Order summary</h2>
              </div>
              <StatusBadge value={investigation.order.status} />
            </div>
            <DefinitionGrid>
              <Definition label="Order ID">
                <code>{investigation.order.id}</code>
              </Definition>
              <Definition label="Payment">
                <StatusBadge value={investigation.order.paymentStatus} />
              </Definition>
              <Definition label="Fulfilment">
                {humanize(investigation.order.fulfilmentType)}
              </Definition>
              <Definition label="Total">{formatInr(investigation.order.totalPaise)}</Definition>
              <Definition label="Customer">
                {investigation.customer.fullName} · {maskPhone(investigation.customer.phoneNumber)}
              </Definition>
              <Definition label="Version">{investigation.order.version}</Definition>
              <Definition label="Placed">{formatDateTime(investigation.order.placedAt)}</Definition>
              <Definition label="Updated">
                {formatDateTime(investigation.order.updatedAt)}
              </Definition>
            </DefinitionGrid>
          </section>

          <section className="panel" aria-labelledby="recovery-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">AAL2 · permission enforced</p>
                <h2 id="recovery-title">Recovery controls</h2>
              </div>
            </div>
            {!manage ? (
              <p className="permission-note">
                Your session has read-only order access. The backend will deny recovery requests.
              </p>
            ) : (
              <div className="action-grid">
                <button
                  className="danger-action"
                  onClick={() => setOperation('CANCEL')}
                  type="button"
                >
                  Cancel eligible order
                </button>
                <button
                  className="secondary-action"
                  onClick={() => setOperation('RETRY_DISPATCH')}
                  type="button"
                >
                  Restart captain search
                </button>
                {delivery === null ? null : (
                  <button
                    className="secondary-action"
                    onClick={() => setOperation('RELEASE_DELIVERY')}
                    type="button"
                  >
                    Release delivery
                  </button>
                )}
                {delivery?.assignedCaptainId === null ? (
                  <button
                    className="secondary-action"
                    onClick={() => setOperation('ASSIGN_CAPTAIN')}
                    type="button"
                  >
                    Assign captain
                  </button>
                ) : null}
                {delivery?.status === 'AT_PICKUP' ? (
                  <button
                    className="secondary-action"
                    onClick={() => setOperation('RESET_PICKUP')}
                    type="button"
                  >
                    Reset pickup verification
                  </button>
                ) : null}
                {delivery?.status === 'AT_DROP' ? (
                  <button
                    className="secondary-action"
                    onClick={() => setOperation('RESET_OTP')}
                    type="button"
                  >
                    Reset delivery verification
                  </button>
                ) : null}
              </div>
            )}
          </section>

          <div className="two-column">
            <section className="panel" aria-labelledby="delivery-title">
              <div className="section-heading">
                <h2 id="delivery-title">Delivery task</h2>
              </div>
              {delivery === null ? (
                <EmptyPanel
                  description="The order does not currently have a forward-delivery task."
                  title="No delivery task"
                />
              ) : (
                <DefinitionGrid>
                  <Definition label="Task ID">
                    <code>{delivery.taskId}</code>
                  </Definition>
                  <Definition label="Status">
                    <StatusBadge value={delivery.status} />
                  </Definition>
                  <Definition label="Captain">
                    {delivery.assignedCaptainId === null ? (
                      'Unassigned'
                    ) : (
                      <Link href={`/captains/${delivery.assignedCaptainId}`}>
                        {delivery.assignedCaptainId}
                      </Link>
                    )}
                  </Definition>
                  <Definition label="Assignment attempts">{delivery.assignmentAttempts}</Definition>
                  <Definition label="Assigned">{formatDateTime(delivery.assignedAt)}</Definition>
                  <Definition label="Updated">{formatDateTime(delivery.updatedAt)}</Definition>
                </DefinitionGrid>
              )}
            </section>
            <section className="panel" aria-labelledby="case-title">
              <div className="section-heading">
                <h2 id="case-title">Linked support cases</h2>
              </div>
              {investigation.cases.length === 0 ? (
                <EmptyPanel
                  description="No support case is linked to this order."
                  title="No linked cases"
                />
              ) : (
                <ul className="record-list">
                  {investigation.cases.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>
                          {item.ticketNumber} · {item.subject}
                        </strong>
                        <small>
                          {humanize(item.category)} · {formatDateTime(item.updatedAt)}
                        </small>
                      </span>
                      <StatusBadge value={item.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="panel" aria-labelledby="timeline-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Oldest to newest</p>
                <h2 id="timeline-title">Order status timeline</h2>
              </div>
            </div>
            <ol className="timeline">
              {investigation.statusHistory.map((entry) => (
                <li key={entry.id}>
                  <span className="timeline__marker" aria-hidden="true" />
                  <div>
                    <div className="timeline__heading">
                      <StatusBadge value={entry.newStatus} />
                      <time>{formatDateTime(entry.createdAt)}</time>
                    </div>
                    <p>
                      {entry.previousStatus === null
                        ? 'Order created'
                        : `${humanize(entry.previousStatus)} → ${humanize(entry.newStatus)}`}
                    </p>
                    <small>
                      {humanize(entry.changedByRole)}
                      {entry.reasonCode === null ? '' : ` · ${humanize(entry.reasonCode)}`}
                      {entry.note === null ? '' : ` · ${entry.note}`}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel" aria-labelledby="audit-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Immutable audit trail</p>
                <h2 id="audit-title">Order recovery history</h2>
              </div>
              <Link
                className="text-action"
                href={`/audit?resourceType=ORDER&resourceId=${orderId}`}
              >
                Open audit explorer
              </Link>
            </div>
            {investigation.audit.length === 0 ? (
              <EmptyPanel
                description="No privileged recovery has been recorded for this order."
                title="No audit events"
              />
            ) : (
              <ul className="record-list">
                {investigation.audit.map((entry) => (
                  <li key={entry.id}>
                    <span>
                      <strong>{humanize(entry.action)}</strong>
                      <small>
                        {humanize(entry.reasonCode)} · {formatDateTime(entry.createdAt)}
                        {entry.note === null ? '' : ` · ${entry.note}`}
                      </small>
                    </span>
                    <code>{entry.idempotencyKey.slice(0, 8)}…</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {operation === null || dialogCopy === null ? null : (
        <OperationDialog
          confirmLabel={dialogCopy[2]}
          extraFields={
            operation === 'ASSIGN_CAPTAIN' ? (
              <label>
                Captain UUID
                <input
                  onChange={(event) => setCaptainId(event.target.value)}
                  pattern="[0-9a-fA-F-]{36}"
                  required
                  value={captainId}
                />
              </label>
            ) : undefined
          }
          impact={dialogCopy[1]}
          onClose={() => setOperation(null)}
          onCompleted={(result) => {
            setOutcome(result);
            setOperation(null);
            resource.reload();
          }}
          onSubmit={submitOperation}
          title={dialogCopy[0]}
        />
      )}
    </div>
  );
}
