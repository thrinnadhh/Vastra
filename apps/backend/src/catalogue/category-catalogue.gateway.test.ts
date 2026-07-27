import { describe, expect, it } from 'vitest';

import { SupabaseCategoryCatalogueGateway } from './category-catalogue.gateway';

describe('SupabaseCategoryCatalogueGateway', () => {
  it('remains constructible when shared record parsers are used', () => {
    expect(new SupabaseCategoryCatalogueGateway()).toBeInstanceOf(SupabaseCategoryCatalogueGateway);
  });
});
