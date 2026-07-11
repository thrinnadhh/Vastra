Implement catalogue and inventory in vertical, testable tickets.

Scope:

- Categories
- Shops
- Products
- Product images
- Product variants
- SKU and barcode
- Variant inventory balances
- Inventory movements
- Inventory reservations
- Barcode lookup
- Manual lookup
- Offline sale
- Low-stock read model

Critical acceptance:

- Merchant accesses only own shop.
- Inventory cannot be negative.
- All adjustments are backend transactions.
- Every change creates immutable movement.
- Offline sale changes inventory once.
- Duplicate request is idempotent.
- Last-unit concurrency test passes.
- Product reads expose only approved/active catalogue to customers.

Photo product recognition is out of scope.

Return a ticket plan first. Execute one ticket at a time.
