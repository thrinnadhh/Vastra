---
status: implemented
implemented_date: 2026-07-26
surface: admin-dashboard
---

# Admin operations dashboard

## Scope

The admin web application now provides a secure, read-focused operations surface for
authorized Vastra administrators. It intentionally does not add order mutations,
approval workflows, finance actions, support tooling, or configuration controls.

## Access and session boundary

- The browser authenticates directly with Supabase Auth by email and password.
- Sessions are held in memory only and are not persisted to browser storage.
- The application calls the backend `/me` endpoint before rendering operations data.
- Access fails closed unless the authenticated account is active, has an admin role,
  has the required dashboard and live-order permissions, and has reached AAL2.
- Accounts that need a second factor are guided through a verified TOTP challenge.
- The backend remains the authorization authority for every API request.
- Public configuration is validated at startup. Supabase secret keys and legacy
  service-role JWTs are explicitly rejected from the client environment.
- Production endpoints must use HTTPS; only loopback API URLs are accepted over HTTP
  for local development.

## Operations surface

The dashboard consumes generated OpenAPI client operations for:

- the aggregate admin dashboard summary; and
- the cursor-paginated live-order queue.

The UI includes:

- loading, recoverable error, access-denied, empty, and populated states;
- order-status and SLA-risk filters;
- cursor-based incremental loading;
- integer-paise currency rendering;
- explicit session-expiry recovery;
- accessible labels, table semantics, focus states, and reduced-motion support; and
- structured client logging that excludes credentials and tokens.

## HTTP and browser hardening

The Next.js application emits a restrictive content security policy and common browser
security headers. Authentication errors use generic messages, while request IDs remain
available for operational correlation. The Supabase client is configured with
`persistSession: false`, `autoRefreshToken: false`, and
`detectSessionInUrl: false`.

## Automated evidence

- Admin unit/component tests cover access decisions, environment rejection, and all
  operations view states.
- The admin browser test confirms the secure sign-in entry point and verifies that the
  former foundation-only content is absent.
- The generated API client validates the typed admin dashboard response.
- OpenAPI/controller parity covers all 169 non-excluded backend operations.

Real provider authentication and TOTP are not exercised by repository E2E because no
staging administrator credentials are stored in the repository. Those flows require
release-environment evidence before production approval.

## Remaining boundary

This implementation establishes secure read access for operational awareness. A
complete admin workstation still needs approved designs and implementation for order
investigation and recovery actions, merchant/captain approval handling, support cases,
refund and finance operations, audit-history review, and configuration controls.
