'use client';

/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-deprecated, @typescript-eslint/unbound-method */
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

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
  useAdminResource,
} from '../../components/admin-ui';

export default function MerchantsPage() {
  const runtime = useAdminRuntime();
  const [query, setQuery] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [onboardingStatus, setOnboardingStatus] = useState('');
  const [kycStatus, setKycStatus] = useState('');
  const [filters, setFilters] = useState({
    query: '',
    profileStatus: '',
    onboardingStatus: '',
    kycStatus: '',
  });
  const resource = useAdminResource(
    () => runtime.port.merchants({ ...filters, limit: 25 }),
    [
      runtime.port,
      filters.query,
      filters.profileStatus,
      filters.onboardingStatus,
      filters.kycStatus,
    ],
  );

  if (!runtime.hasPermission('admin.merchants.read'))
    return <AccessDenied permission="admin.merchants.read" />;

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ query: query.trim(), profileStatus, onboardingStatus, kycStatus });
  };

  return (
    <div className="page-stack">
      <PageHeader
        description="Privacy-minimal merchant operations, onboarding state and pilot workload. All filtering and pagination remain server-owned."
        eyebrow="Pilot actors"
        title="Merchants"
        actions={
          <button className="secondary-action" onClick={resource.reload} type="button">
            Refresh
          </button>
        }
      />
      <form className="filter-bar" onSubmit={apply}>
        <label>
          Search
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, legal name or phone suffix"
            value={query}
          />
        </label>
        <label>
          Profile status
          <select onChange={(event) => setProfileStatus(event.target.value)} value={profileStatus}>
            <option value="">Any</option>
            {['ACTIVE', 'PENDING', 'BLOCKED', 'SUSPENDED', 'DELETED'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Onboarding
          <select
            onChange={(event) => setOnboardingStatus(event.target.value)}
            value={onboardingStatus}
          >
            <option value="">Any</option>
            {[
              'STARTED',
              'DOCUMENTS_PENDING',
              'VERIFICATION_PENDING',
              'CORRECTION_REQUIRED',
              'APPROVED',
              'CATALOGUE_SETUP',
              'TRAINING_PENDING',
              'ACTIVE',
              'PAUSED',
              'SUSPENDED',
              'REJECTED',
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          KYC
          <select onChange={(event) => setKycStatus(event.target.value)} value={kycStatus}>
            <option value="">Any</option>
            {['PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className="primary-action" type="submit">
          Apply filters
        </button>
      </form>
      {resource.loading && resource.data === null ? (
        <LoadingPanel label="Loading merchants…" />
      ) : null}
      {resource.failure !== null && resource.data === null ? (
        <FailurePanel failure={resource.failure} onRetry={resource.reload} />
      ) : null}
      {resource.stale ? <StaleNotice onRefresh={resource.reload} /> : null}
      {resource.data?.merchants.length === 0 ? (
        <EmptyPanel
          description="Change the search or operational filters."
          title="No matching merchants"
        />
      ) : null}
      {resource.data === null || resource.data.merchants.length === 0 ? null : (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Profile</th>
                  <th>Onboarding</th>
                  <th>KYC</th>
                  <th>Shops</th>
                  <th>Open orders</th>
                  <th>Problems · 30d</th>
                  <th>Updated</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resource.data.merchants.map((merchant) => (
                  <tr key={merchant.id}>
                    <td>
                      <strong>{merchant.legalName}</strong>
                      <small>
                        {merchant.fullName} · ••••{merchant.phoneLast4 ?? '—'}
                      </small>
                    </td>
                    <td>
                      <StatusBadge value={merchant.profileStatus} />
                    </td>
                    <td>
                      <StatusBadge value={merchant.onboardingStatus} />
                    </td>
                    <td>
                      <StatusBadge value={merchant.kycStatus} />
                    </td>
                    <td>{merchant.shopCount}</td>
                    <td>{merchant.openOrders}</td>
                    <td>{merchant.problemOrders30d}</td>
                    <td>{formatDateTime(merchant.updatedAt)}</td>
                    <td>
                      <Link className="table-action" href={`/merchants/${merchant.id}`}>
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pagination-end">
            {resource.data.nextCursor === null
              ? 'End of current results'
              : 'More server results are available; cursor pagination is retained for the next increment.'}
          </p>
        </section>
      )}
    </div>
  );
}
