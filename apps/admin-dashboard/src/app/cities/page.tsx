'use client';

/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-deprecated, @typescript-eslint/no-misused-promises, @typescript-eslint/unbound-method */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { createIdempotencyKey } from '../../admin/admin-api';
import {
  ADMIN_REASON_CODES,
  type AdminCityControlPlane,
  type AdminCityMutationResult,
  type AdminCityPreflightReport,
  type AdminFailure,
  type AdminMutationInput,
  type AdminReasonCode,
  type AdminResult,
} from '../../admin/admin-types';
import { useAdminRuntime } from '../../auth/admin-runtime';
import {
  AccessDenied,
  Definition,
  DefinitionGrid,
  EmptyPanel,
  FailurePanel,
  LoadingPanel,
  PageHeader,
  StaleNotice,
  StatusBadge,
  formatDateTime,
  formatInr,
  humanize,
  useAdminResource,
} from '../../components/admin-ui';

interface ConfigurationDraft {
  readonly defaultCodLimitPaise: string;
  readonly defaultDeliveryRadiusMeters: string;
  readonly maximumDeliveryRadiusMeters: string;
  readonly baseDeliveryFeePaise: string;
  readonly perKmDeliveryFeePaise: string;
  readonly merchantCommissionBps: string;
  readonly localDeliveryEnabled: boolean;
  readonly postalDeliveryEnabled: boolean;
}

function configurationDraft(city: AdminCityControlPlane): ConfigurationDraft {
  return {
    defaultCodLimitPaise: String(city.configuration.defaultCodLimitPaise),
    defaultDeliveryRadiusMeters: String(city.configuration.defaultDeliveryRadiusMeters),
    maximumDeliveryRadiusMeters: String(city.configuration.maximumDeliveryRadiusMeters),
    baseDeliveryFeePaise: String(city.configuration.baseDeliveryFeePaise),
    perKmDeliveryFeePaise: String(city.configuration.perKmDeliveryFeePaise),
    merchantCommissionBps: String(city.configuration.merchantCommissionBps),
    localDeliveryEnabled: city.configuration.localDeliveryEnabled,
    postalDeliveryEnabled: city.configuration.postalDeliveryEnabled,
  };
}

function integerField(value: string, label: string, minimum = 0): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} must be a whole number of at least ${String(minimum)}.`);
  }
  return parsed;
}

function upsertCity(
  cities: readonly AdminCityControlPlane[],
  next: AdminCityControlPlane,
): readonly AdminCityControlPlane[] {
  return cities.map((city) => (city.city.id === next.city.id ? next : city));
}

function checkPassed(value: Readonly<Record<string, unknown>>): boolean {
  return value['passed'] === true;
}

function CityCommandDialog<T>({
  title,
  impact,
  confirmLabel,
  confirmation,
  children,
  onClose,
  onSubmit,
  onCompleted,
}: {
  readonly title: string;
  readonly impact: string;
  readonly confirmLabel: string;
  readonly confirmation?: string;
  readonly children?: ReactNode;
  readonly onClose: () => void;
  readonly onSubmit: (input: AdminMutationInput) => Promise<AdminResult<T>>;
  readonly onCompleted: (value: T) => void;
}) {
  const [reasonCode, setReasonCode] = useState<AdminReasonCode>('OPERATIONAL_RECOVERY');
  const [note, setNote] = useState('');
  const [confirmationValue, setConfirmationValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const idempotencyKey = useRef(createIdempotencyKey());
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  busyRef.current = busy;
  onCloseRef.current = onClose;

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (!element.open) element.showModal();

    const cancel = (event: Event) => {
      event.preventDefault();
      if (busyRef.current) return;
      element.close();
      onCloseRef.current();
    };

    element.addEventListener('cancel', cancel);
    return () => {
      element.removeEventListener('cancel', cancel);
      if (element.open) element.close();
    };
  }, []);

  const requestClose = () => {
    if (busyRef.current) return;
    if (dialog.current?.open) dialog.current.close();
    onCloseRef.current();
  };

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
    if (confirmation !== undefined && confirmationValue !== confirmation) {
      setFailure({
        kind: 'VALIDATION',
        message: `Type ${confirmation} exactly to confirm this lifecycle change.`,
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
    if (dialog.current?.open) dialog.current.close();
    onCompleted(result.data);
  };

  return (
    <div className="dialog-backdrop">
      <dialog aria-labelledby="city-command-dialog-title" className="operation-dialog" ref={dialog}>
        <form onSubmit={submit}>
          <p className="eyebrow">Audited city command</p>
          <h2 id="city-command-dialog-title">{title}</h2>
          <div className="impact-panel">
            <strong>Expected impact</strong>
            <p>{impact}</p>
          </div>
          {children}
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
            Note
            <textarea
              disabled={busy}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional unless the reason is Other"
              rows={3}
              value={note}
            />
          </label>
          {confirmation === undefined ? null : (
            <label>
              Type {confirmation} to confirm
              <input
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setConfirmationValue(event.target.value)}
                value={confirmationValue}
              />
            </label>
          )}
          {failure === null ? null : <FailurePanel failure={failure} />}
          <p className="idempotency-note">
            One idempotency identity is retained while the outcome is uncertain.
          </p>
          <div className="dialog-actions">
            <button
              className="secondary-action"
              disabled={busy}
              onClick={requestClose}
              type="button"
            >
              Cancel
            </button>
            <button className="primary-action" disabled={busy} type="submit">
              {busy ? 'Submitting…' : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function PreflightPanel({ report }: { readonly report: AdminCityPreflightReport | null }) {
  if (report === null) {
    return (
      <EmptyPanel
        description="Run the auditable preflight before attempting city activation."
        title="No activation report"
      />
    );
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Activation gate</p>
          <h2>Latest preflight</h2>
        </div>
        <StatusBadge value={report.passed ? 'PASSED' : 'BLOCKED'} />
      </div>
      <DefinitionGrid>
        <Definition label="Created">{formatDateTime(report.createdAt)}</Definition>
        <Definition label="Configuration version">{report.cityConfigurationVersion}</Definition>
        <Definition label="Readiness version">{report.readinessVersion}</Definition>
        <Definition label="City state">{humanize(report.cityStatus)}</Definition>
      </DefinitionGrid>
      <ul className="preflight-grid">
        {Object.entries(report.checks).map(([name, check]) => (
          <li
            className={checkPassed(check) ? 'preflight-check--pass' : 'preflight-check--fail'}
            key={name}
          >
            <div>
              <strong>{humanize(name)}</strong>
              <StatusBadge value={checkPassed(check) ? 'PASSED' : 'BLOCKED'} />
            </div>
            <pre>{JSON.stringify(check, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CitiesPage() {
  const runtime = useAdminRuntime();
  const canRead = runtime.hasPermission('admin.configuration.read');
  const canManage = runtime.hasPermission('admin.configuration.manage');
  const resource = useAdminResource(() => runtime.port.cities(), [runtime.port]);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const selected = useMemo(
    () =>
      resource.data?.find((city) => city.city.id === selectedCityId) ?? resource.data?.[0] ?? null,
    [resource.data, selectedCityId],
  );
  const [draft, setDraft] = useState<ConfigurationDraft | null>(null);
  const [configurationFailure, setConfigurationFailure] = useState<AdminFailure | null>(null);
  const [configurationMessage, setConfigurationMessage] = useState<string | null>(null);
  const [configurationBusy, setConfigurationBusy] = useState(false);
  const [command, setCommand] = useState<'PREFLIGHT' | 'ACTIVATE' | 'PAUSE' | null>(null);

  if (!canRead) return <AccessDenied permission="admin.configuration.read" />;

  const effectiveDraft = selected === null ? null : (draft ?? configurationDraft(selected));

  const updateDraft = (patch: Partial<ConfigurationDraft>) => {
    if (effectiveDraft !== null) setDraft({ ...effectiveDraft, ...patch });
  };

  const replaceSelected = (next: AdminCityControlPlane) => {
    if (resource.data !== null) resource.setData(upsertCity(resource.data, next));
    setSelectedCityId(next.city.id);
    setDraft(null);
  };

  const saveConfiguration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selected === null || effectiveDraft === null || !canManage) return;
    setConfigurationBusy(true);
    setConfigurationFailure(null);
    setConfigurationMessage(null);
    let patch: Readonly<Record<string, unknown>>;
    try {
      patch = {
        defaultCodLimitPaise: integerField(effectiveDraft.defaultCodLimitPaise, 'COD limit'),
        defaultDeliveryRadiusMeters: integerField(
          effectiveDraft.defaultDeliveryRadiusMeters,
          'Default delivery radius',
          1,
        ),
        maximumDeliveryRadiusMeters: integerField(
          effectiveDraft.maximumDeliveryRadiusMeters,
          'Maximum delivery radius',
          1,
        ),
        baseDeliveryFeePaise: integerField(
          effectiveDraft.baseDeliveryFeePaise,
          'Base delivery fee',
        ),
        perKmDeliveryFeePaise: integerField(
          effectiveDraft.perKmDeliveryFeePaise,
          'Per-kilometre delivery fee',
        ),
        merchantCommissionBps: integerField(
          effectiveDraft.merchantCommissionBps,
          'Merchant commission',
        ),
        localDeliveryEnabled: effectiveDraft.localDeliveryEnabled,
        postalDeliveryEnabled: effectiveDraft.postalDeliveryEnabled,
      };
    } catch (error: unknown) {
      setConfigurationFailure({
        kind: 'VALIDATION',
        message: error instanceof Error ? error.message : 'Review the configuration values.',
        requestId: null,
        requiresRefresh: false,
      });
      setConfigurationBusy(false);
      return;
    }
    const result = await runtime.port.updateCityConfiguration(
      selected.city.id,
      selected.configuration.version,
      patch,
      {
        reasonCode: 'DATA_CORRECTION',
        note: 'Updated from the city configuration control plane',
        idempotencyKey: createIdempotencyKey(),
      },
    );
    setConfigurationBusy(false);
    if (result.kind === 'FAILURE') {
      setConfigurationFailure(result.failure);
      return;
    }
    replaceSelected(result.data.controlPlane);
    setConfigurationMessage(
      result.data.replayed
        ? 'The prior idempotent configuration result was restored.'
        : 'Configuration saved with a new authoritative version.',
    );
  };

  return (
    <div className="page-stack">
      <PageHeader
        actions={
          <button
            className="secondary-action"
            onClick={() => {
              setDraft(null);
              resource.reload();
            }}
            type="button"
          >
            Refresh
          </button>
        }
        description="Configure market defaults, inspect service coverage, and activate or pause a city only through fresh auditable preflight evidence."
        eyebrow="Phase 2E control plane"
        title="Cities"
      />
      {resource.loading && resource.data === null ? <LoadingPanel label="Loading cities…" /> : null}
      {resource.failure !== null && resource.data === null ? (
        <FailurePanel failure={resource.failure} onRetry={resource.reload} />
      ) : null}
      {resource.stale ? (
        <StaleNotice
          onRefresh={() => {
            setDraft(null);
            resource.reload();
          }}
        />
      ) : null}
      {resource.data?.length === 0 ? (
        <EmptyPanel
          description="Create the first city through the trusted backend before using this control plane."
          title="No cities are configured"
        />
      ) : null}
      {selected === null || effectiveDraft === null ? null : (
        <>
          <section className="panel city-selector-panel">
            <label>
              Managed city
              <select
                onChange={(event) => {
                  setDraft(null);
                  setSelectedCityId(event.target.value);
                }}
                value={selected.city.id}
              >
                {resource.data?.map((city) => (
                  <option key={city.city.id} value={city.city.id}>
                    {city.city.name} · {humanize(city.city.status)}
                  </option>
                ))}
              </select>
            </label>
            <div className="action-grid">
              <button
                className="secondary-action"
                disabled={!canManage}
                onClick={() => setCommand('PREFLIGHT')}
                type="button"
              >
                Run preflight
              </button>
              {selected.city.status === 'ACTIVE' ? (
                <button
                  className="danger-action"
                  disabled={!canManage}
                  onClick={() => setCommand('PAUSE')}
                  type="button"
                >
                  Pause city
                </button>
              ) : (
                <button
                  className="primary-action"
                  disabled={!canManage || selected.latestPreflight?.passed !== true}
                  onClick={() => setCommand('ACTIVATE')}
                  type="button"
                >
                  {selected.city.status === 'PAUSED' ? 'Restore city' : 'Activate city'}
                </button>
              )}
            </div>
          </section>

          {!canManage ? (
            <p className="permission-note">
              You can inspect city state but cannot change configuration or lifecycle controls.
            </p>
          ) : null}

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Market identity</p>
                <h2>{selected.city.name}</h2>
              </div>
              <StatusBadge value={selected.city.status} />
            </div>
            <DefinitionGrid>
              <Definition label="City code">{selected.city.code}</Definition>
              <Definition label="State">{selected.city.stateCode}</Definition>
              <Definition label="Country">{selected.city.countryCode}</Definition>
              <Definition label="Last updated">
                {formatDateTime(selected.city.updatedAt)}
              </Definition>
              <Definition label="Activated">{formatDateTime(selected.city.activatedAt)}</Definition>
              <Definition label="Paused">{formatDateTime(selected.city.pausedAt)}</Definition>
              <Definition label="Configuration version">
                {selected.configuration.version}
              </Definition>
              <Definition label="Readiness version">{selected.readiness.version}</Definition>
            </DefinitionGrid>
          </section>

          <form className="panel configuration-form" onSubmit={saveConfiguration}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Versioned commercial defaults</p>
                <h2>Configuration</h2>
              </div>
              <span>Version {selected.configuration.version}</span>
            </div>
            <div className="configuration-grid">
              <label>
                COD limit · paise
                <input
                  disabled={!canManage || configurationBusy}
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => updateDraft({ defaultCodLimitPaise: event.target.value })}
                  required
                  type="number"
                  value={effectiveDraft.defaultCodLimitPaise}
                />
              </label>
              <label>
                Default delivery radius · metres
                <input
                  disabled={!canManage || configurationBusy}
                  inputMode="numeric"
                  min="1"
                  onChange={(event) =>
                    updateDraft({ defaultDeliveryRadiusMeters: event.target.value })
                  }
                  required
                  type="number"
                  value={effectiveDraft.defaultDeliveryRadiusMeters}
                />
              </label>
              <label>
                Maximum delivery radius · metres
                <input
                  disabled={!canManage || configurationBusy}
                  inputMode="numeric"
                  min="1"
                  onChange={(event) =>
                    updateDraft({ maximumDeliveryRadiusMeters: event.target.value })
                  }
                  required
                  type="number"
                  value={effectiveDraft.maximumDeliveryRadiusMeters}
                />
              </label>
              <label>
                Base delivery fee · paise
                <input
                  disabled={!canManage || configurationBusy}
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => updateDraft({ baseDeliveryFeePaise: event.target.value })}
                  required
                  type="number"
                  value={effectiveDraft.baseDeliveryFeePaise}
                />
              </label>
              <label>
                Per-kilometre fee · paise
                <input
                  disabled={!canManage || configurationBusy}
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => updateDraft({ perKmDeliveryFeePaise: event.target.value })}
                  required
                  type="number"
                  value={effectiveDraft.perKmDeliveryFeePaise}
                />
              </label>
              <label>
                Merchant commission · basis points
                <input
                  disabled={!canManage || configurationBusy}
                  inputMode="numeric"
                  max="10000"
                  min="0"
                  onChange={(event) => updateDraft({ merchantCommissionBps: event.target.value })}
                  required
                  type="number"
                  value={effectiveDraft.merchantCommissionBps}
                />
              </label>
            </div>
            <div className="configuration-toggles">
              <label>
                <input
                  checked={effectiveDraft.localDeliveryEnabled}
                  disabled={!canManage || configurationBusy}
                  onChange={(event) => updateDraft({ localDeliveryEnabled: event.target.checked })}
                  type="checkbox"
                />
                Local delivery enabled
              </label>
              <label>
                <input
                  checked={effectiveDraft.postalDeliveryEnabled}
                  disabled={!canManage || configurationBusy}
                  onChange={(event) => updateDraft({ postalDeliveryEnabled: event.target.checked })}
                  type="checkbox"
                />
                Postal delivery enabled
              </label>
            </div>
            <DefinitionGrid>
              <Definition label="Current COD limit">
                {formatInr(selected.configuration.defaultCodLimitPaise)}
              </Definition>
              <Definition label="Current base fee">
                {formatInr(selected.configuration.baseDeliveryFeePaise)}
              </Definition>
              <Definition label="Current per-km fee">
                {formatInr(selected.configuration.perKmDeliveryFeePaise)}
              </Definition>
              <Definition label="Timezone">{selected.configuration.timezone}</Definition>
            </DefinitionGrid>
            {configurationMessage === null ? null : (
              <p className="success-notice" role="status">
                {configurationMessage}
              </p>
            )}
            {configurationFailure === null ? null : (
              <FailurePanel
                failure={configurationFailure}
                {...(configurationFailure.requiresRefresh ? { onRetry: resource.reload } : {})}
              />
            )}
            <div className="action-grid">
              <button
                className="primary-action"
                disabled={!canManage || configurationBusy}
                type="submit"
              >
                {configurationBusy ? 'Saving…' : 'Save configuration'}
              </button>
              <button
                className="secondary-action"
                disabled={configurationBusy}
                onClick={() => setDraft(configurationDraft(selected))}
                type="button"
              >
                Reset form
              </button>
            </div>
          </form>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Operational evidence</p>
                <h2>Readiness inputs</h2>
              </div>
              <StatusBadge
                value={selected.readiness.unresolvedHighBlockers === 0 ? 'NO_BLOCKERS' : 'BLOCKED'}
              />
            </div>
            <DefinitionGrid>
              <Definition label="Active captains">
                {selected.readiness.activeCaptainCount}
              </Definition>
              <Definition label="Standby captains">
                {selected.readiness.standbyCaptainCount}
              </Definition>
              <Definition label="Payment provider">
                {selected.readiness.paymentProviderHealthy ? 'Healthy' : 'Not proven'}
              </Definition>
              <Definition label="SMS / OTP">
                {selected.readiness.smsOtpProviderHealthy ? 'Healthy' : 'Not proven'}
              </Definition>
              <Definition label="FCM">
                {selected.readiness.fcmProviderHealthy ? 'Healthy' : 'Not proven'}
              </Definition>
              <Definition label="Observability">
                {selected.readiness.observabilityHealthy ? 'Healthy' : 'Not proven'}
              </Definition>
              <Definition label="Validation order">
                {selected.readiness.validationOrderId ?? 'Not recorded'}
              </Definition>
              <Definition label="High / critical blockers">
                {selected.readiness.unresolvedHighBlockers}
              </Definition>
            </DefinitionGrid>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Serviceability</p>
                <h2>Zones and pincodes</h2>
              </div>
              <span>{selected.zones.length} zones</span>
            </div>
            {selected.zones.length === 0 ? (
              <EmptyPanel
                description="At least one validation-ready zone with active pincode coverage is required."
                title="No service zones"
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Status</th>
                      <th>Radius</th>
                      <th>Version</th>
                      <th>Pincodes</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.zones.map((zone) => (
                      <tr key={zone.id}>
                        <td>
                          <strong>{zone.name}</strong>
                          <small>{zone.code}</small>
                        </td>
                        <td>
                          <StatusBadge value={zone.status} />
                        </td>
                        <td>
                          {zone.defaultDeliveryRadiusMeters === null
                            ? 'City default'
                            : `${String(zone.defaultDeliveryRadiusMeters)} m`}
                        </td>
                        <td>{zone.version}</td>
                        <td>
                          {zone.pincodes.length === 0
                            ? 'None'
                            : zone.pincodes
                                .map(
                                  (pincode) =>
                                    `${pincode.pincode}${pincode.isPrimary ? ' · primary' : ''}`,
                                )
                                .join(', ')}
                        </td>
                        <td>{formatDateTime(zone.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <PreflightPanel report={selected.latestPreflight} />

          {command === 'PREFLIGHT' ? (
            <CityCommandDialog
              confirmLabel="Run preflight"
              impact="Creates an immutable report from the current configuration, merchant coverage, captain capacity, provider health, validation order, owner assignments, and release blockers."
              onClose={() => setCommand(null)}
              onCompleted={(report: AdminCityPreflightReport) => {
                replaceSelected({ ...selected, latestPreflight: report });
                setCommand(null);
              }}
              onSubmit={(input) => runtime.port.runCityPreflight(selected.city.id, input)}
              title={`Evaluate ${selected.city.name}`}
            />
          ) : null}
          {command === 'ACTIVATE' ? (
            <CityCommandDialog
              confirmLabel={selected.city.status === 'PAUSED' ? 'Restore city' : 'Activate city'}
              confirmation={selected.city.code}
              impact="Allows new commercial orders only when the backend accepts the latest fresh passing preflight. Existing authorization, inventory, payment, audit, and city-isolation controls remain enforced."
              onClose={() => setCommand(null)}
              onCompleted={(result: AdminCityMutationResult) => {
                replaceSelected(result.controlPlane);
                setCommand(null);
              }}
              onSubmit={(input) => runtime.port.activateCity(selected.city.id, input)}
              title={`${selected.city.status === 'PAUSED' ? 'Restore' : 'Activate'} ${selected.city.name}`}
            />
          ) : null}
          {command === 'PAUSE' ? (
            <CityCommandDialog
              confirmLabel="Pause city"
              confirmation={selected.city.code}
              impact="Stops new affected orders and pauses active service zones while preserving existing orders, support, refunds, returns, audit records, and recovery flows."
              onClose={() => setCommand(null)}
              onCompleted={(result: AdminCityMutationResult) => {
                replaceSelected(result.controlPlane);
                setCommand(null);
              }}
              onSubmit={(input) => runtime.port.pauseCity(selected.city.id, input)}
              title={`Pause ${selected.city.name}`}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
