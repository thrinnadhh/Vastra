# CI/CD Instructions

These rules extend the repository `AGENTS.md`.

## Pull request checks

CI should run:

- Dependency install with lockfile
- Lint
- Typecheck
- Unit tests
- Database tests
- Integration tests
- OpenAPI validation
- Builds
- Secret scanning
- Dependency/security scanning

## Safety

- Never print secrets.
- Use environment-scoped credentials.
- Production deployment requires approval.
- Database migrations run before application rollout only through an approved workflow.
- Failed migrations stop deployment.
- Do not auto-deploy unreviewed pull requests to production.
