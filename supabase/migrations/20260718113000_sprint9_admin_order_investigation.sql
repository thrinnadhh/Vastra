create or replace function public.get_admin_order_investigation(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public, private
stable
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id,
      'orderNumber', o.order_number,
      'customerId', o.customer_id,
      'shopId', o.shop_id,
      'status', o.status,
      'paymentStatus', o.payment_status,
      'fulfilmentType', o.fulfilment_type,
      'totalPaise', o.total_paise,
      'placedAt', o.placed_at,
      'acceptedAt', o.accepted_at,
      'readyAt', o.ready_at,
      'pickedUpAt', o.picked_up_at,
      'deliveredAt', o.delivered_at,
      'completedAt', o.completed_at,
      'cancelledAt', o.cancelled_at,
      'updatedAt', o.updated_at,
      'version', o.version
    ),
    'customer', jsonb_build_object(
      'id', p.id,
      'fullName', p.full_name,
      'phoneNumber', p.phone_number,
      'status', p.status
    ),
    'statusHistory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'previousStatus', h.previous_status,
        'newStatus', h.new_status,
        'changedByUserId', h.changed_by_user_id,
        'changedByRole', h.changed_by_role,
        'reasonCode', h.reason_code,
        'note', h.note,
        'createdAt', h.created_at
      ) order by h.created_at)
      from public.order_status_history h where h.order_id = o.id
    ), '[]'::jsonb),
    'delivery', (
      select jsonb_build_object(
        'taskId', d.id,
        'status', d.status,
        'assignedCaptainId', d.assigned_captain_id,
        'assignmentAttempts', d.assignment_attempts,
        'assignedAt', d.assigned_at,
        'pickedUpAt', d.picked_up_at,
        'completedAt', d.completed_at,
        'updatedAt', d.updated_at
      )
      from public.delivery_tasks d
      where d.order_id = o.id and d.task_type = 'FORWARD_DELIVERY'
      order by d.created_at desc limit 1
    ),
    'cases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'ticketNumber', s.ticket_number,
        'category', s.category,
        'priority', s.priority,
        'status', s.status,
        'subject', s.subject,
        'assignedTo', s.assigned_to,
        'createdAt', s.created_at,
        'updatedAt', s.updated_at
      ) order by s.created_at desc)
      from public.support_tickets s where s.order_id = o.id
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from private.admin_audit_log a
      where a.resource_type = 'ORDER' and a.resource_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  join public.profiles p on p.id = o.customer_id
  where o.id = p_order_id
$$;

revoke all on function public.get_admin_order_investigation(uuid) from public, anon, authenticated;
grant execute on function public.get_admin_order_investigation(uuid) to service_role;
