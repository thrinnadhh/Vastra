import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RootLayout from './layout';

describe('RootLayout', () => {
  it('provides the shared admin skip-link, navigation, and main landmark', () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <section aria-label="Test content">Content</section>
      </RootLayout>,
    );

    expect(markup).toContain('Skip to main content');
    expect(markup).toContain('href="#admin-main-content"');
    expect(markup).toContain('aria-label="Admin navigation"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('<main');
    expect(markup).toContain('id="admin-main-content"');
    expect(markup).toContain('Content');
  });
});
