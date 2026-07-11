---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# Security Model

## 1. Principles

- Least privilege
- Deny by default
- Defence in depth
- No client-side trust
- Auditable sensitive actions
- Private-by-default storage
- Short-lived signed access
- Separate environment secrets

## 2. Authentication

- Supabase Auth issues access tokens.
- Backend verifies token signature and claims.
- Device registration is separate from authentication.
- Admin accounts require MFA.
- Refresh tokens are securely stored on device.
- Logout revokes the active session where supported.

## 3. Authorization

Every protected request uses:

1. Authenticated identity
2. Account status check
3. Role or account type
4. Resource ownership
5. Fine-grained permission
6. Business-state validation

## 4. RLS

Enable RLS on every exposed table.

Examples:

- Customer reads own orders only.
- Merchant reads orders belonging to own shop.
- Captain reads assigned delivery only.
- User reads own notification only.
- Public reads only approved, active shops/products.

Service-role access is backend-only.

## 5. Secrets

Never expose:

- Supabase service-role/secret key
- Payment secret
- Webhook secret
- SMS secret
- FCM service account
- Encryption key
- Database password

Client applications may contain only public/publishable keys designed for client use.

## 6. Storage

Buckets:

| Bucket | Access |
|---|---|
| product-images | Public or transformed public |
| shop-images | Public |
| merchant-documents | Private |
| captain-documents | Private |
| return-evidence | Private |
| support-attachments | Private |
| body-scans | Private, post-MVP |
| virtual-tryon | Private, post-MVP |

Use signed URLs with short expiry.

## 7. Payment security

- Verify webhook signatures.
- Read raw request body.
- Deduplicate provider events.
- Never trust payment success from client.
- Keep payment secrets backend-only.
- Never store full card details.

## 8. API protection

- Rate limit authentication and sensitive routes.
- Validate all input.
- Set body size limits.
- Use idempotency keys.
- Apply CORS allowlists.
- Use secure headers.
- Reject unsupported content types.
- Sanitize logs.

## 9. Mobile security

- Secure token storage
- Certificate pinning only after operational review
- No secrets in bundle
- Root/jailbreak detection optional, not sole control
- Disable screenshots on highly sensitive KYC screens when justified
- Clear private cached files

## 10. Admin security

- MFA
- Strong session timeout
- IP/device monitoring
- Separate production access
- Audit every sensitive action
- Mandatory reason for overrides
- Permission review
- Disable inactive accounts

## 11. Logging

Never log:

- OTP values
- Access/refresh tokens
- Full bank account
- KYC document content
- Payment secrets
- Full customer addresses unless operationally necessary
- Raw private evidence URLs

## 12. Security tests

- Cross-customer access
- Cross-merchant access
- Unassigned captain access
- Privilege escalation
- RLS bypass attempts
- IDOR
- Webhook forgery
- Replay
- Duplicate idempotency key
- Malicious file upload
- Rate-limit abuse
