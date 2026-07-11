---
project: Vastra
version: 1.1
status: Frozen MVP
last_updated: 2026-07-11
---

# Database Schema Summary

## 1. Supabase rule

Use Supabase-managed `auth.users`. Application profile data lives in `public.profiles`.

## 2. Core entities

### Identity

- profiles
- user_devices
- customer_profiles
- merchant_profiles
- captain_profiles
- admin_profiles
- roles
- permissions
- user_roles
- role_permissions

### Marketplace

- addresses
- shops
- shop_hours
- shop_documents
- shop_bank_accounts
- categories
- products
- product_images
- product_variants
- variant_barcodes
- shop_favourites

### Inventory

- inventory_balances
- inventory_movements
- inventory_reservations
- offline_sales
- offline_sale_items

### Commerce

- carts
- cart_items
- orders
- order_items
- order_status_history
- merchant_order_alerts
- merchant_order_issues
- order_item_verifications
- payments
- payment_events
- refunds

### Wardrobe and looks

- wardrobe_items
- saved_looks
- saved_look_items

### Group Style

- group_rooms
- group_room_invites
- group_room_members
- group_room_shares
- group_room_votes
- group_room_comments
- group_room_shortlist_items
- group_room_abuse_reports

### Logistics

- delivery_tasks
- delivery_assignments
- captain_current_locations
- captain_location_history
- delivery_events
- cod_collections
- captain_earnings
- captain_payouts

### Returns and support

- return_requests
- return_items
- return_evidence
- return_status_history
- support_tickets
- support_messages

### Operations

- approval_requests
- audit_logs
- outbox_events

## 3. Key table requirements

### profiles

- id UUID PK referencing auth.users
- account_type
- full_name
- phone_number
- avatar_url
- status
- created_at
- updated_at

### shops

- id
- merchant_id
- shop_code
- name
- description
- address_id
- location geography(point,4326)
- accepts_online_orders
- operational_status
- rating_average
- follower_count
- version
- timestamps

### product_variants

- id
- product_id
- shop_id
- sku
- colour_name
- colour_hex
- size_label
- mrp_paise
- selling_price_paise
- attributes jsonb
- is_active
- timestamps

### inventory_balances

- id
- shop_id
- variant_id
- stock_on_hand
- reserved_quantity
- damaged_quantity
- reorder_level
- version
- updated_at

Unique: `(shop_id, variant_id)`

### orders

- id
- order_number
- customer_id
- shop_id
- delivery_address_id
- status
- payment_status
- subtotal_paise
- discount values
- delivery_fee_paise
- tax_paise
- total_paise
- preparation minutes
- timestamps
- version

### order_items

Store immutable snapshots:

- product name
- SKU
- colour
- size
- image
- quantity
- MRP
- selling price
- discount
- total

### delivery_tasks

- id
- order_id
- task_type
- pickup and drop references
- status
- assigned_captain_id
- pickup_code_hash
- delivery_otp_hash
- distance and duration estimates
- timestamps

### wardrobe_items

- id UUID PK
- owner_customer_id UUID FK
- storage_object_key (private bucket key; never a public URL)
- category, colour, occasion, season
- notes nullable
- status (`ACTIVE`, `DELETED`)
- created_at, updated_at, deleted_at as UTC `timestamptz`

### saved_looks and saved_look_items

- saved_looks: id UUID PK, owner_customer_id UUID FK, name, UTC timestamps
- saved_look_items: id UUID PK, look_id UUID FK, item_type
  (`WARDROBE_ITEM`, `PRODUCT_VARIANT`), exactly one wardrobe_item_id or
  product_variant_id, display_position, UTC timestamps
- Look product references do not snapshot or reserve price or availability.

### group_rooms, invites, and members

- group_rooms: id UUID PK, owner_customer_id UUID FK, name, status
  (`OPEN`, `CLOSED`), closed_at, UTC timestamps
- group_room_invites: id UUID PK, room_id UUID FK, token_hash and/or code_hash,
  expires_at, revoked_at, max_uses, use_count, created_by, UTC timestamps
- group_room_members: id UUID PK, room_id UUID FK, customer_id UUID FK, role
  (`OWNER`, `PARTICIPANT`), status (`ACTIVE`, `REMOVED`), joined_at, removed_at,
  removed_by

### group_room activity

- group_room_shares: id UUID PK, room_id UUID FK, shared_by UUID FK, share_type
  (`PRODUCT_VARIANT`, `SAVED_LOOK`), exactly one source reference, a validated
  room-visible look snapshot for saved-look shares, UTC timestamps. Snapshots store
  source UUIDs and display order, never signed media URLs or product prices.
- group_room_votes: id UUID PK, share_id UUID FK, voter_customer_id UUID FK,
  vote (`LOVE`, `MAYBE`, `SKIP`), UTC timestamps
- group_room_comments: id UUID PK, share_id UUID FK, author_customer_id UUID FK,
  body, status, UTC timestamps
- group_room_shortlist_items: id UUID PK, room_id UUID FK, share_id UUID FK,
  added_by UUID FK, created_at
- group_room_abuse_reports: id UUID PK, room_id UUID FK, reporter_customer_id
  UUID FK, share_id/comment_id nullable, reason, details nullable, status, UTC
  timestamps

## 4. Constraints

- No negative inventory values.
- Selling price and MRP are non-negative.
- Quantity is positive.
- Rating is between 1 and 5.
- One barcode value is unique.
- One active accepted captain assignment per delivery task.
- One active favourite record per customer/shop.
- One active balance row per shop/variant.
- One membership row per room/customer; only active members may read room data.
- One effective vote per share/voter.
- One shortlist row per room/share.
- Look and room polymorphic references enforce exactly one valid source.
- Invite expiry must be later than creation; revoked/expired invites cannot be used.
- Wardrobe storage keys are unique and owner-scoped.

## 5. Indexes

Required:

- GIST on shop location
- GIST on captain location
- Orders by customer and created_at
- Orders by shop, status, created_at
- Inventory by shop and variant
- Delivery tasks by status
- Alerts by shop, status, expiry
- Products by shop/category/is_active
- Support tickets by assignee/status
- Audit logs by entity and created_at
- Wardrobe items by owner/status/created_at
- Saved looks by owner/updated_at and look items by look/display_position
- Room memberships by customer/status and room/status
- Room shares/comments by room/created_at
- Votes by share and shortlist items by room
- Active invites by room/expires_at
- Abuse reports by status/created_at

## 6. Partition candidates

Partition later by month:

- customer_events
- captain_location_history
- audit_logs
- notification_deliveries
- order_status_history at high scale

## 7. Migration rules

- Every change uses a versioned migration.
- Migrations are reviewed before production.
- Destructive changes require backup and rollback plan.
- Never rename/drop high-use columns without compatibility release.
- Seed files must not contain production secrets.
