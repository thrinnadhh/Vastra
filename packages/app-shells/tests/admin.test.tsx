import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AdminApplicationShell } from '../src/admin.js';

describe('AdminApplicationShell', () => {
  it('renders a keyboard-accessible landmark foundation', () => {
    const markup = renderToStaticMarkup(
      <AdminApplicationShell
        navigation={[
          { href: '/', label: 'Overview', current: true },
          { href: '/orders', label: 'Orders' },
        ]}
        productLabel="Vastra Admin"
        secondaryPanel={<p>Context</p>}
        utility={<p>Signed in</p>}
      >
        <h1>Dashboard</h1>
      </AdminApplicationShell>,
    );

    expect(markup).toContain('href="#admin-main-content"');
    expect(markup).toContain('Skip to main content');
    expect(markup).toContain('<header');
    expect(markup).toContain('aria-label="Admin navigation"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('id="admin-main-content"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('aria-label="Context panel"');
  });

  it('does not manufacture feature controls', () => {
    const markup = renderToStaticMarkup(
      <AdminApplicationShell
        navigation={[{ href: '/', label: 'Overview', current: true }]}
        productLabel="Vastra Admin"
      >
        <p>Foundation</p>
      </AdminApplicationShell>,
    );

    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<form');
    expect(markup).not.toContain('role="dialog"');
  });
});
