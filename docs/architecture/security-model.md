---
project: Vastra
version: 1.1
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
- Customer reads and writes only owned wardrobe metadata through the backend.
- Active room members read room activity; removed/non-members receive no room data.
- A room-scoped saved-look snapshot exposes only the items selected when it was
  shared; later source-look edits do not expand room access.
- Group activity tables deny direct client writes; backend authorization is required.

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
| wardrobe-items | Private; owner or active room-scoped shared-look access |
| body-scans | Not provisioned for MVP |
| virtual-tryon | Not provisioned for MVP |

Use signed URLs with short expiry. The backend checks current ownership or active
room membership before issuing each wardrobe-media URL. URLs are not stored in
durable room records. Wardrobe deletion first makes the object ineligible for new
signed URLs, then removes the object; cached URLs must have short expiry.

## 7. Wardrobe and Group Style authorization

- Wardrobe/list/look management requires the authenticated owner.
- Finalizing or deleting wardrobe media is backend-mediated. Upload URLs are
  single-purpose, size/type limited, short-lived, and scoped to an owner key prefix.
- Creating invites, removing members, and closing a room requires room ownership.
- Joining requires an open room and an unexpired, unrevoked invite/link or code.
- Sharing, voting, commenting, shortlisting, reporting, and reading room activity
  require active membership in an open room; retained members may only read a
  closed room.
- Removed members immediately lose room subscriptions, API reads, and eligibility
  for new media URLs. Previously issued media URLs expire shortly.
- Abuse reports are visible only to their reporter and authorized support/admin
  reviewers. Report targets do not see reporter identity through room APIs.
- Source product price and stock are read from authorized catalogue/inventory
  projections; clients cannot overwrite them in look or room payloads.
- Rate-limit room creation, invite generation/join attempts, comments, and reports.

## 8. Payment security

- Verify webhook signatures.
- Read raw request body.
- Deduplicate provider events.
- Never trust payment success from client.
- Keep payment secrets backend-only.
- Never store full card details.

## 9. API protection

- Rate limit authentication and sensitive routes.
- Validate all input.
- Set body size limits.
- Use idempotency keys.
- Apply CORS allowlists.
- Use secure headers.
- Reject unsupported content types.
- Sanitize logs.

## 10. Mobile security

- Secure token storage
- Certificate pinning only after operational review
- No secrets in bundle
- Root/jailbreak detection optional, not sole control
- Disable screenshots on highly sensitive KYC screens when justified
- Clear private cached files

## 11. Admin security

- MFA
- Strong session timeout
- IP/device monitoring
- Separate production access
- Audit every sensitive action
- Mandatory reason for overrides
- Permission review
- Disable inactive accounts

## 12. Logging

Never log:

- OTP values
- Access/refresh tokens
- Full bank account
- KYC document content
- Payment secrets
- Full customer addresses unless operationally necessary
- Raw private evidence URLs
- Wardrobe signed URLs, raw invite tokens/join codes, and private room content

## 13. Security tests

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
- Cross-customer wardrobe and look access
- Non-member, removed-member, and closed-room mutation access
- Expired/revoked invite use and join-code enumeration
- Wardrobe media access after deletion or membership removal
- Abuse reporter identity disclosure
