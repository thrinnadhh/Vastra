# Group Style MVP Implementation

Implement the private Group Style rooms and social sharing feature.

## Scope Boundary

- Private Group Style rooms. Invite-only access via link or join-code with UTC expiry.
- Sharing product variants and/or room-visible snapshots of saved looks within rooms.
- Cast/update one `LOVE`/`MAYBE`/`SKIP` vote per shared item per participant, comment, shortlist, and report abuse.
- Individual cart addition and checkout from shared room products.
- Abuse reporting (private to reporter and authorized reviewers/admins).

## One-ticket-at-a-time implementation rule

You must return an ordered ticket plan first and then implement one ticket at a time. Copy `codex/TASK_TEMPLATE.md` to define and execute each ticket. Do not build all features in a single command.

## Canonical documents to read

Before implementation, read the following:
- docs/product/mvp-scope.md
- docs/product/business-rules.md
- docs/workflows/customer-workflows.md
- docs/architecture/database-schema.md
- docs/architecture/security-model.md
- docs/api/openapi.yaml
- docs/testing/acceptance-tests.md

## Ordered implementation tasks

1. **Schema Migrations**: Create tables for rooms, invites, memberships, shares, votes, comments, shortlists, and abuse reports.
2. **Room Management**: Implement room creation, listing, and detail retrieval (`POST`, `GET` `/customer/group-style/rooms` and `GET` `/customer/group-style/rooms/{roomId}`).
3. **Invitation Flow**: Implement invite generation with UTC expiry, usage limits, and hashed join-codes/secrets (`POST /customer/group-style/rooms/{roomId}/invites`).
4. **Room Join Flow**: Implement joining a room using an invite token or join code (`POST /customer/group-style/memberships`), ensuring validation of expiration, revocation, and use count.
5. **Membership Control**: Implement role-based controls allowing the room owner to remove participants (`DELETE /customer/group-style/rooms/{roomId}/members/{customerId}`).
6. **Room Closure**: Implement room closure by owner (`POST /customer/group-style/rooms/{roomId}/closure`), rendering the room read-only for remaining members.
7. **Social Sharing**: Implement product variant and saved look snapshot sharing (`POST /customer/group-style/rooms/{roomId}/shares`). Look shares must snapshot composition and display order without sharing signed URLs or prices.
8. **Voting**: Implement `LOVE`/`MAYBE`/`SKIP` votes (`PUT /customer/group-style/rooms/{roomId}/shares/{shareId}/vote`), ensuring an update updates the existing vote instead of duplicating.
9. **Comments**: Implement text comments (`POST /customer/group-style/rooms/{roomId}/shares/{shareId}/comments`).
10. **Shortlist**: Implement shortlist management (`PUT` and `DELETE` `/customer/group-style/rooms/{roomId}/shortlist/{shareId}`) unique per room and share.
11. **Individual Checkout**: Implement add-to-cart for available variants from a room (`POST /customer/group-style/rooms/{roomId}/shares/{shareId}/cart-items`), enforcing independent cart, payment, address, and order.
12. **Abuse Reporting**: Implement abuse reporting endpoint (`POST /customer/group-style/rooms/{roomId}/reports`), ensuring reports remain private.
13. **Realtime Notifications (Optional Delivery)**: Emit realtime events only after DB commits are completed successfully.

## Database requirements

- **Table: `group_rooms`**:
  - `id` UUID PK
  - `owner_customer_id` UUID FK referencing `customers`
  - `name` text, `status` text (`OPEN`, `CLOSED`)
  - `closed_at` timestamptz nullable (UTC)
  - `created_at`, `updated_at` timestamptz (UTC)
- **Table: `group_room_invites`**:
  - `id` UUID PK
  - `room_id` UUID FK referencing `group_rooms`
  - `token_hash` text, `code_hash` text
  - `expires_at` timestamptz (UTC)
  - `revoked_at` timestamptz nullable (UTC)
  - `max_uses` integer, `use_count` integer
  - `created_by` UUID FK referencing `customers`
  - `created_at` timestamptz (UTC)
- **Table: `group_room_members`**:
  - `id` UUID PK
  - `room_id` UUID FK referencing `group_rooms`
  - `customer_id` UUID FK referencing `customers`
  - `role` text (`OWNER`, `PARTICIPANT`)
  - `status` text (`ACTIVE`, `REMOVED`)
  - `joined_at` timestamptz, `removed_at` timestamptz nullable, `removed_by` UUID FK nullable
- **Table: `group_room_shares`**:
  - `id` UUID PK
  - `room_id` UUID FK referencing `group_rooms`
  - `shared_by` UUID FK referencing `customers`
  - `share_type` text (`PRODUCT_VARIANT`, `SAVED_LOOK`)
  - `product_variant_id` UUID FK referencing `product_variants` (nullable)
  - `look_snapshot` jsonb (nullable)
  - `created_at`, `updated_at` timestamptz (UTC)
- **Table: `group_room_votes`**:
  - `id` UUID PK
  - `share_id` UUID FK referencing `group_room_shares`
  - `voter_customer_id` UUID FK referencing `customers`
  - `vote` text (`LOVE`, `MAYBE`, `SKIP`)
  - `created_at`, `updated_at` timestamptz (UTC)
- **Table: `group_room_comments`**:
  - `id` UUID PK
  - `share_id` UUID FK referencing `group_room_shares`
  - `author_customer_id` UUID FK referencing `customers`
  - `body` text, `status` text
  - `created_at`, `updated_at` timestamptz (UTC)
- **Table: `group_room_shortlist_items`**:
  - `id` UUID PK
  - `room_id` UUID FK referencing `group_rooms`
  - `share_id` UUID FK referencing `group_room_shares`
  - `added_by` UUID FK referencing `customers`
  - `created_at` timestamptz (UTC)
- **Table: `group_room_abuse_reports`**:
  - `id` UUID PK
  - `room_id` UUID FK referencing `group_rooms`
  - `reporter_customer_id` UUID FK referencing `customers`
  - `share_id` UUID FK referencing `group_room_shares` (nullable)
  - `comment_id` UUID FK referencing `group_room_comments` (nullable)
  - `reason` text, `details` text nullable, `status` text
  - `created_at`, `updated_at` timestamptz (UTC)
- **Constraints**:
  - One membership row per room/customer.
  - One effective vote per share/voter.
  - One shortlist row per room/share.
  - Invite Expiry Constraint: The database schema must enforce `expires_at > created_at` as a persistent CHECK constraint. Application validation must verify that `expires_at` is in the future relative to the current time (`now()`) at the moment of creation. Do not implement a permanent database constraint comparing `expires_at` to `now()`.
- **Indexes**:
  - memberships: `customer_id` / `room_id`
  - shares & comments: `room_id`, `created_at`
  - votes: `share_id`, `voter_customer_id`

## API requirements

Endpoints conforming to docs/api/openapi.yaml:
- `GET /customer/group-style/rooms`
- `POST /customer/group-style/rooms`
- `POST /customer/group-style/memberships`
- `GET /customer/group-style/rooms/{roomId}`
- `POST /customer/group-style/rooms/{roomId}/closure`
- `POST /customer/group-style/rooms/{roomId}/invites`
- `DELETE /customer/group-style/rooms/{roomId}/members/{customerId}`
- `POST /customer/group-style/rooms/{roomId}/shares`
- `PUT /customer/group-style/rooms/{roomId}/shares/{shareId}/vote`
- `POST /customer/group-style/rooms/{roomId}/shares/{shareId}/comments`
- `POST /customer/group-style/rooms/{roomId}/shares/{shareId}/cart-items`
- `PUT /customer/group-style/rooms/{roomId}/shortlist/{shareId}`
- `DELETE /customer/group-style/rooms/{roomId}/shortlist/{shareId}`
- `POST /customer/group-style/rooms/{roomId}/reports`

## Authorization and privacy requirements

- Room content, members, comments, and votes are private to active members.
- Expired or revoked invites immediately fail join attempts without exposing room details.
- Removing a member immediately revokes database, API, realtime, and shared-media access.
- Room closure makes all room states read-only; no new shares, comments, votes, or shortlist items can be added.
- Shared look snapshots grant access only to the look snapshot data, not the owner's general wardrobe list.
- Abuse reports are private to reporter and reviewer.
- All tokens/join codes must be hashed in the database; bearer values must never be stored in plaintext.

## Test requirements

- **Integration Tests**:
  - Verify `AC-C10`: Join with expired/revoked invite fails with `GROUP_INVITE_EXPIRED`.
  - Verify `AC-C11`: Removed member immediately denied API, realtime, and shared-media access.
  - Verify `AC-C12`: Vote update logic retains only one effective vote per voter/share.
  - Verify `AC-C13`: Out of stock product stays visible but cart addition is rejected with stock error.
  - Verify `AC-C14`: Two members checking out the same product use separate carts, payments, and orders.
  - Verify `AC-C15`: Room closure enforces read-only access.
  - Verify `AC-C16`: Realtime delivery disconnected preserves durable records; report/reporter privacy is maintained.

## Commands that must pass

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Explicit exclusions

- Shared carts, split/shared payments, or combined orders.
- Group-level rewards or automatic social discovery.
- Live video shopping integrations.
- Public group discovery or public rooms.
- AI stylist chat or automated style recommendation.
