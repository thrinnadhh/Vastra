# Shared Packages Instructions

These rules extend the repository `AGENTS.md`.

## Boundaries

Shared packages may contain:

- API clients
- Domain types
- Validation schemas
- Design tokens
- Reusable UI
- Analytics contracts
- Test utilities
- Configuration helpers

They must not:

- Import app-specific navigation
- Depend on secret environment variables
- Hide business-critical network writes
- Create circular dependencies
- Duplicate OpenAPI-generated types

## Compatibility

- Avoid breaking shared API changes.
- Add migration notes for breaking exports.
- Keep mobile-compatible packages free from Node-only imports.
- Add unit tests for shared validation and calculations.
