import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AdminPage from './page';

describe('AdminPage', () => {
  it('renders a secure session check without manufacturing privileged data', () => {
    const markup = renderToStaticMarkup(<AdminPage />);

    expect(markup).toContain('Checking secure admin session');
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('System shell available');
    expect(markup).not.toContain('Open orders');
    expect(markup).not.toContain('<main');
  });
});
