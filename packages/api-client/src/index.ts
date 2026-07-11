/**
 * Marker for the future generated API client.
 *
 * The client must eventually be generated from docs/api/openapi.yaml.
 * Do not manually duplicate endpoint schemas in this package.
 */
export const API_CLIENT_GENERATION_BOUNDARY = {
  contract: 'docs/api/openapi.yaml',
  status: 'not-generated',
} as const;

export type ApiClientGenerationBoundary = typeof API_CLIENT_GENERATION_BOUNDARY;
