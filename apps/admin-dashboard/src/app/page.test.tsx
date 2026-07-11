import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AdminFoundationPage from './page';

describe('AdminFoundationPage', () => {
  it('renders the accessible foundation health screen', () => {
    const markup = renderToStaticMarkup(<AdminFoundationPage />);

    expect(markup).toContain('<main');
    expect(markup).toContain('Vastra Admin — foundation ready');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('System shell available');
  });

  it('does not render operational controls or simulated access', () => {
    const markup = renderToStaticMarkup(<AdminFoundationPage />);

    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<form');
    expect(markup).not.toContain('Sign in');
    expect(markup).not.toContain('Admin role');
  });
});
