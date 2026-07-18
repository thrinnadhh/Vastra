---
sprint: 9
ticket: S9-03
status: implemented
---

# S9-03 operations dashboard and global search

The admin dashboard is read-only and permission-gated. It reports open and intervention-prone orders, dispatch load, open support cases and suspended actors. Global search supports order number, resource UUID, customer phone, merchant identity, captain code and case number while returning operational labels rather than raw phone numbers.

Database reads are exposed only to the service role through `get_admin_operations_dashboard` and `search_admin_operations`. Direct authenticated clients have no execute privilege.
