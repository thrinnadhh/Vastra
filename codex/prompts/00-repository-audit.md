Audit the Vastra repository before implementation.

Do not modify files.

Read:

- Root and nested AGENTS.md files
- docs/README.md if present
- docs/product/product-requirements.md
- docs/product/mvp-scope.md
- docs/product/business-rules.md
- docs/workflows/order-state-machine.md
- docs/architecture/system-architecture.md
- docs/architecture/database-schema.md
- docs/architecture/security-model.md
- docs/api/openapi.yaml
- docs/testing/acceptance-tests.md

Report:

1. Current repository tree
2. Existing apps, packages, migrations, scripts, and CI
3. Missing files expected by the architecture
4. Conflicts between implementation and documentation
5. Secret or unsafe configuration risks
6. OpenAPI validity
7. Whether standard verification commands exist
8. Whether Supabase local development is configured
9. Recommended Sprint 0 tickets in dependency order
10. Clear go/no-go decision for implementation

Do not invent missing implementation. Do not create files.
