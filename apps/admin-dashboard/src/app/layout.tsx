import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AdminRuntimeProvider } from '../auth/admin-runtime';
import { AdminShell } from '../components/admin-shell';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Vastra Admin', template: '%s · Vastra Admin' },
  description: 'Permission-aware Vastra operations observation and recovery control plane',
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en-IN">
      <body>
        <AdminRuntimeProvider>
          <AdminShell>{children}</AdminShell>
        </AdminRuntimeProvider>
      </body>
    </html>
  );
}
