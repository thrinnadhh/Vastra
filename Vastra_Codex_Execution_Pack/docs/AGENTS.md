# Documentation Instructions

These rules extend the repository `AGENTS.md`.

## Canonical status

Documentation is part of the product contract.

When behavior changes, update the relevant documentation in the same task.

## Change rules

- Do not silently expand frozen MVP scope.
- Update `product/mvp-scope.md` only after explicit approval.
- Update `api/openapi.yaml` for API changes.
- Update `api/error-codes.md` for new public errors.
- Update workflows for state changes.
- Update acceptance tests for requirement changes.
- Keep examples consistent with integer paise and UTC timestamps.

## Review

Before completing a documentation change:

- Check links and paths.
- Check terminology across files.
- Validate OpenAPI YAML.
- Confirm no secrets or real customer data are included.
