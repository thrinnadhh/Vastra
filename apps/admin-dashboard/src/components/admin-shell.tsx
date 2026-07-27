'use client';

import { AdminApplicationShell } from '@vastra/app-shells/admin';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import type { AdminPermission } from '../admin/admin-types';
import { useAdminRuntime } from '../auth/admin-runtime';

const NAVIGATION: readonly {
  readonly href: string;
  readonly label: string;
  readonly permission: AdminPermission;
}[] = [
  { href: '/', label: 'Overview', permission: 'admin.dashboard.read' },
  { href: '/orders', label: 'Orders', permission: 'admin.orders.read' },
  { href: '/merchants', label: 'Merchants', permission: 'admin.merchants.read' },
  { href: '/captains', label: 'Captains', permission: 'admin.captains.read' },
  { href: '/audit', label: 'Audit', permission: 'admin.audit.read' },
];

function isCurrent(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const runtime = useAdminRuntime();
  const navigation = NAVIGATION.filter((item) => runtime.hasPermission(item.permission)).map(
    (item) => ({
      href: item.href,
      label: item.label,
      ...(isCurrent(pathname, item.href) ? { current: true as const } : {}),
    }),
  );

  return (
    <AdminApplicationShell
      navigation={
        navigation.length === 0 ? [{ href: '/', label: 'Overview', current: true }] : navigation
      }
      productLabel="Vastra Admin"
      utility={
        <>
          <div className="session-summary">
            <span className="live-indicator" aria-hidden="true" />
            <span>
              <strong>AAL2</strong> · {runtime.email}
            </span>
          </div>
          <button className="utility-action" onClick={() => void runtime.signOut()} type="button">
            Sign out
          </button>
        </>
      }
    >
      {children}
    </AdminApplicationShell>
  );
}
