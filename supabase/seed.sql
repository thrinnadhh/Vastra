-- Deterministic local-development reference data.
--
-- No production users, passwords, payment data, or private merchant data are
-- included. Application users remain managed by Supabase Auth.

insert into public.roles (
  id,
  code,
  name,
  description,
  is_system_role
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'SUPER_ADMIN',
    'Super Administrator',
    'Full platform administration role.',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'OPERATIONS_ADMIN',
    'Operations Administrator',
    'Order, merchant, and delivery operations role.',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'FINANCE_ADMIN',
    'Finance Administrator',
    'Payment, refund, settlement, and payout role.',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'SUPPORT_AGENT',
    'Support Agent',
    'Customer, merchant, and captain support role.',
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system_role = excluded.is_system_role;

insert into public.permissions (
  id,
  code,
  module,
  name,
  description
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'platform.read',
    'PLATFORM',
    'Read platform data',
    'Read administrative platform data.'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'platform.write',
    'PLATFORM',
    'Write platform data',
    'Perform trusted administrative changes.'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'operations.manage',
    'OPERATIONS',
    'Manage operations',
    'Manage order and delivery operations.'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'finance.manage',
    'FINANCE',
    'Manage finance',
    'Manage payments, refunds, and payouts.'
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    'support.manage',
    'SUPPORT',
    'Manage support',
    'Manage support tickets and escalations.'
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    'catalogue.moderate',
    'CATALOGUE',
    'Moderate catalogue',
    'Approve and reject catalogue content.'
  ),
  (
    '20000000-0000-0000-0000-000000000007',
    'settings.manage',
    'CONFIGURATION',
    'Manage settings',
    'Manage platform configuration.'
  )
on conflict (code) do update
set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  r.id,
  p.id
from public.roles r
cross join public.permissions p
where r.code = 'SUPER_ADMIN'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  r.id,
  p.id
from public.roles r
join public.permissions p
  on p.code in (
    'platform.read',
    'operations.manage',
    'catalogue.moderate'
  )
where r.code = 'OPERATIONS_ADMIN'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  r.id,
  p.id
from public.roles r
join public.permissions p
  on p.code in (
    'platform.read',
    'finance.manage'
  )
where r.code = 'FINANCE_ADMIN'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  r.id,
  p.id
from public.roles r
join public.permissions p
  on p.code in (
    'platform.read',
    'support.manage'
  )
where r.code = 'SUPPORT_AGENT'
on conflict (role_id, permission_id) do nothing;

insert into public.categories (
  id,
  parent_id,
  name,
  slug,
  description,
  display_order,
  is_active
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    null,
    'Men',
    'men',
    'Men clothing, footwear, and accessories.',
    10,
    true
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    null,
    'Women',
    'women',
    'Women clothing, footwear, and accessories.',
    20,
    true
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    null,
    'Kids',
    'kids',
    'Kids clothing, footwear, and accessories.',
    30,
    true
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    null,
    'Footwear',
    'footwear',
    'Footwear for all customer groups.',
    40,
    true
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    null,
    'Accessories',
    'accessories',
    'Fashion and occasion accessories.',
    50,
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order,
  is_active = excluded.is_active;
