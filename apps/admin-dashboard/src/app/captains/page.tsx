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

export default function CaptainsPage() {
  const runtime = useAdminRuntime();
  const [query, setQuery] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [kycStatus, setKycStatus] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState('');
  const [filters, setFilters] = useState({
    query: '',
    profileStatus: '',
    kycStatus: '',
    availabilityStatus: '',
  });
  const resource = useAdminResource(
    () => runtime.port.captains({ ...filters, limit: 25 }),
    [
      runtime.port,
      filters.query,
      filters.profileStatus,
      filters.kycStatus,
      filters.availabilityStatus,
    ],
  );
  if (!runtime.hasPermission('admin.captains.read'))
    return <AccessDenied permission="admin.captains.read" />;
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ query: query.trim(), profileStatus, kycStatus, availabilityStatus });
  };
  return (
    <div className="page-stack">
      <PageHeader
        description="Privacy-minimal delivery-partner readiness, active-task state and recent operational risk."
        eyebrow="Pilot actors"
        title="Captains"
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
            placeholder="Name, captain code or phone suffix"
            value={query}
          />
        </label>
        <label>
          Profile
          <select onChange={(event) => setProfileStatus(event.target.value)} value={profileStatus}>
            <option value="">Any</option>
            {['ACTIVE', 'PENDING', 'BLOCKED', 'SUSPENDED', 'DELETED'].map((value) => (
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
        <label>
          Availability
          <select
            onChange={(event) => setAvailabilityStatus(event.target.value)}
            value={availabilityStatus}
          >
            <option value="">Any</option>
            {[
              'OFFLINE',
              'AVAILABLE',
              'OFFERED',
              'ASSIGNED',
              'AT_PICKUP',
              'DELIVERING',
              'ON_BREAK',
              'SUSPENDED',
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className="primary-action" type="submit">
          Apply filters
        </button>
      </form>
      {resource.loading && resource.data === null ? (
        <LoadingPanel label="Loading captains…" />
      ) : null}
      {resource.failure !== null && resource.data === null ? (
        <FailurePanel failure={resource.failure} onRetry={resource.reload} />
      ) : null}
      {resource.stale ? <StaleNotice onRefresh={resource.reload} /> : null}
      {resource.data?.captains.length === 0 ? (
        <EmptyPanel
          description="Change the search or operational filters."
          title="No matching captains"
        />
      ) : null}
      {resource.data === null || resource.data.captains.length === 0 ? null : (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Captain</th>
                  <th>Profile</th>
                  <th>KYC</th>
                  <th>Availability</th>
                  <th>Vehicle</th>
                  <th>Rating</th>
                  <th>Deliveries</th>
                  <th>Problems · 30d</th>
                  <th>Location</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resource.data.captains.map((captain) => (
                  <tr key={captain.id}>
                    <td>
                      <strong>{captain.fullName}</strong>
                      <small>
                        {captain.captainCode} · ••••{captain.phoneLast4 ?? '—'}
                      </small>
                    </td>
                    <td>
                      <StatusBadge value={captain.profileStatus} />
                    </td>
                    <td>
                      <StatusBadge value={captain.kycStatus} />
                    </td>
                    <td>
                      <StatusBadge value={captain.availabilityStatus} />
                    </td>
                    <td>{captain.vehicleType ?? 'Not recorded'}</td>
                    <td>{captain.ratingAverage?.toFixed(1) ?? '—'}</td>
                    <td>{captain.completedDeliveries}</td>
                    <td>{captain.problemDeliveries30d}</td>
                    <td>{formatDateTime(captain.locationRecordedAt)}</td>
                    <td>
                      <Link className="table-action" href={`/captains/${captain.id}`}>
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
