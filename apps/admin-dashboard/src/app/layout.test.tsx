import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RootLayout, { metadata } from './layout';

describe('RootLayout', () => {
  it('publishes the operational admin metadata', () => {
    expect(metadata.description).toContain('Permission-aware');
    expect(metadata.title).toStrictEqual({
      default: 'Vastra Admin',
      template: '%s · Vastra Admin',
    });
  });

  it('fails closed when public runtime configuration is absent', () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <p>Protected content</p>
      </RootLayout>,
    );
    expect(markup).toContain('Vastra Admin is not configured');
    expect(markup).not.toContain('Protected content');
  });
});
