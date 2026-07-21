import type { ReactNode } from 'react';

import { createAdminShellContract, type AdminNavigationItem } from './contracts.js';

export interface AdminApplicationShellProps {
  readonly productLabel: string;
  readonly navigation: readonly AdminNavigationItem[];
  readonly children: ReactNode;
  readonly utility?: ReactNode;
  readonly secondaryPanel?: ReactNode;
  readonly mainContentId?: string;
}

export function AdminApplicationShell({
  productLabel,
  navigation,
  children,
  utility,
  secondaryPanel,
  mainContentId,
}: AdminApplicationShellProps): React.JSX.Element {
  const contract = createAdminShellContract({
    productLabel,
    navigation,
    ...(mainContentId === undefined ? {} : { mainContentId }),
    hasSecondaryPanel: secondaryPanel !== undefined,
  });

  return (
    <>
      <a className="admin-shell__skip-link" href={contract.skipLinkHref}>
        Skip to main content
      </a>
      <div className="admin-shell" data-shell="admin">
        <header className="admin-shell__topbar">
          <a className="admin-shell__brand" href="/">
            {contract.productLabel}
          </a>
          {utility === undefined ? null : (
            <div aria-label="Admin utilities" className="admin-shell__utility">
              {utility}
            </div>
          )}
        </header>
        <aside className="admin-shell__sidebar">
          <nav aria-label={contract.navigationLabel}>
            <ul className="admin-shell__navigation-list">
              {contract.navigation.map((item) => (
                <li key={item.href}>
                  <a
                    aria-current={item.current === true ? 'page' : undefined}
                    className="admin-shell__navigation-link"
                    href={item.href}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <main className="admin-shell__main" id={contract.mainContentId} tabIndex={-1}>
          {children}
        </main>
        {contract.hasSecondaryPanel && secondaryPanel !== undefined ? (
          <aside aria-label="Context panel" className="admin-shell__secondary">
            {secondaryPanel}
          </aside>
        ) : null}
      </div>
    </>
  );
}
