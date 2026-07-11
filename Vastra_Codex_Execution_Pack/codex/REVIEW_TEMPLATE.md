# Codex Review Request

Review the current uncommitted diff against:

- Root and nested `AGENTS.md`
- Frozen MVP scope
- Business rules
- Order state machine
- Security model
- OpenAPI
- Acceptance tests

Focus on:

1. Security vulnerabilities
2. Authorization/RLS gaps
3. Data corruption risks
4. Race conditions
5. Idempotency defects
6. Invalid state transitions
7. Secret exposure
8. API contract mismatch
9. Missing error/loading/offline states
10. Missing tests
11. Unrelated changes
12. Documentation drift

Do not edit files during the first review pass.

Return findings ordered by severity with file and line references. State explicitly when no issue is found in a category.
