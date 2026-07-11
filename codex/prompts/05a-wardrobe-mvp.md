# Wardrobe MVP Implementation

Implement the private customer wardrobe and saved looks feature.

## Scope Boundary

- Private wardrobe with customer-uploaded photos (private storage) and manual metadata (category, colour, occasion, season, optional notes).
- Saved looks combining owned wardrobe items and nearby Vastra shop product variants.
- CRUD operations for saved looks (create, rename, duplicate, delete, and privately share to Group Style rooms).
- Real-time catalog price and availability resolution for product variants when viewing looks or adding/checking them out in the customer's own cart.

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

1. **Storage Bucket Provisioning**: Configure a private Supabase Storage bucket `wardrobe-media` with owner-scoped read/write security rules.
2. **Upload Intent Endpoint**: Implement logic for requesting signed upload URLs (`POST /customer/wardrobe/upload-intents`).
3. **Wardrobe Item Creation**: Implement verification of uploaded storage objects and metadata registration (`POST /customer/wardrobe/items`).
4. **Wardrobe Item Management**: Implement retrieve, list, edit, and deletion APIs (`GET`, `PATCH`, `DELETE` `/customer/wardrobe/items` and `/customer/wardrobe/items/{wardrobeItemId}`).
5. **Saved Looks Management**: Implement tables and CRUD APIs for looks composition (`GET`, `POST`, `PATCH`, `DELETE` `/customer/looks` and `/customer/looks/{lookId}`).
6. **Look Duplication**: Implement duplication logic (`POST /customer/looks/{lookId}/duplicates`) assigning new UUIDs to duplicates.
7. **Real-time Product Resolution**: Fetch current catalog variant price (integer paise) and availability dynamically when reading looks.
8. **Add-to-cart Revalidation**: Implement individual checkout/cart-add for look variants (`POST /customer/looks/{lookId}/cart-items`), revalidating stock, price, and the one-shop cart rule.

## Database requirements

- **Table: `wardrobe_items`**:
  - `id` UUID PK
  - `owner_customer_id` UUID FK referencing `customers`
  - `storage_object_key` text unique (private bucket key, never a public URL)
  - `category` text, `colour` text, `occasion` text, `season` text
  - `notes` text nullable
  - `status` text (`ACTIVE`, `DELETED`)
  - `created_at`, `updated_at`, `deleted_at` timestamptz (UTC)
- **Table: `saved_looks`**:
  - `id` UUID PK
  - `owner_customer_id` UUID FK referencing `customers`
  - `name` text
  - `created_at`, `updated_at` timestamptz (UTC)
- **Table: `saved_look_items`**:
  - `id` UUID PK
  - `look_id` UUID FK referencing `saved_looks`
  - `item_type` text (`WARDROBE_ITEM`, `PRODUCT_VARIANT`)
  - `wardrobe_item_id` UUID FK referencing `wardrobe_items` (nullable)
  - `product_variant_id` UUID FK referencing `product_variants` (nullable)
  - `display_position` integer
  - `created_at`, `updated_at` timestamptz (UTC)
- **Indexes**:
  - Wardrobe items: `owner_customer_id`, `status`, `created_at`
  - Saved looks: `owner_customer_id`, `updated_at`
  - Look items: `look_id`, `display_position`
- **Constraints**: Enforce exactly one source reference (`wardrobe_item_id` XOR `product_variant_id`).

## API requirements

Must implement the following endpoints conforming to docs/api/openapi.yaml:
- `POST /customer/wardrobe/upload-intents`
- `GET /customer/wardrobe/items`
- `POST /customer/wardrobe/items`
- `GET /customer/wardrobe/items/{wardrobeItemId}`
- `PATCH /customer/wardrobe/items/{wardrobeItemId}`
- `DELETE /customer/wardrobe/items/{wardrobeItemId}`
- `GET /customer/looks`
- `POST /customer/looks`
- `GET /customer/looks/{lookId}`
- `PATCH /customer/looks/{lookId}`
- `DELETE /customer/looks/{lookId}`
- `POST /customer/looks/{lookId}/duplicates`
- `POST /customer/looks/{lookId}/cart-items`

## Authorization and privacy requirements

- Private wardrobe items and saved looks are owner-scoped. No cross-customer metadata access is allowed.
- Signed URLs for wardrobe media must expire.
- Wardrobe item deletion must be backend-mediated and transactional:
  - Revoke signed access and mark the database record as `DELETED`.
  - Remove/tombstone active look references.
  - Delete the storage object (failed object deletions must be retried and must not restore user access).
- Sharing a saved look grants room members access only to the look snapshot and selected wardrobe media in that room context; it never exposes the wider wardrobe catalog or other wardrobe metadata.

## Test requirements

- **Unit/Integration Tests**:
  - Verify auth check rejecting non-owner requests (Customer A vs B) for items, metadata, and media URLs.
  - Verify look duplication creates a new UUID with identical composition.
  - Verify wardrobe deletion tombstoning and media URL revocation.
- **Concurrency & Concurrency safety**:
  - Ensure concurrent look deletions or item deletions do not cause orphan storage objects or stale look references.

## Acceptance criteria

- **AC-C07**: Private wardrobe metadata/media URL requests by non-owner fail with access denied.
- **AC-C08**: Wardrobe deletion revokes media access immediately, tombstones looks, and schedules object deletion.
- **AC-C09**: Look CRUD works only for the owner, duplication yields new UUIDs and same ordered item sequence.

## Commands that must pass

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Explicit exclusions

- AI clothing recognition, auto-tagging, or categorization.
- Body scanning and virtual try-on.
- Automatic image segmentation or background removal.
- AI outfit generation or recommendations.
- Size fit predictions.
- Video wardrobe scanning.
