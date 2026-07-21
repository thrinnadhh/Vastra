import { AdminApplicationShell } from '@vastra/app-shells/admin';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Vastra Admin',
  description: 'Vastra administration foundation',
};

const ADMIN_NAVIGATION = [{ href: '/', label: 'Overview', current: true }] as const;

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <AdminApplicationShell navigation={ADMIN_NAVIGATION} productLabel="Vastra Admin">
          {children}
        </AdminApplicationShell>
      </body>
    </html>
  );
}
