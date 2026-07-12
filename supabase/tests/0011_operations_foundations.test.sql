begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(41);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'notification_priority'
  ),
  'LOW,NORMAL,HIGH,URGENT',
  'notification priorities are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'notification_channel'
  ),
  'PUSH,SMS,WHATSAPP,EMAIL,IN_APP',
  'notification channels are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'support_ticket_status'
  ),
  'OPEN,ASSIGNED,IN_PROGRESS,WAITING_FOR_USER,ESCALATED,RESOLVED,CLOSED',
  'support ticket statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'outbox_event_status'
  ),
  'PENDING,PROCESSING,PUBLISHED,FAILED,DEAD_LETTER',
  'outbox statuses are defined'
);

select ok(to_regclass('public.notifications') is not null, 'notifications exist');
select ok(to_regclass('public.notification_deliveries') is not null, 'notification deliveries exist');
select ok(to_regclass('public.notification_preferences') is not null, 'notification preferences exist');
select ok(to_regclass('public.support_tickets') is not null, 'support tickets exist');
select ok(to_regclass('public.support_messages') is not null, 'support messages exist');
select ok(to_regclass('public.approval_requests') is not null, 'approval requests exist');
select ok(to_regclass('public.audit_logs') is not null, 'audit logs exist');
select ok(to_regclass('public.outbox_events') is not null, 'outbox events exist');
select ok(to_regclass('public.system_settings') is not null, 'system settings exist');

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'notifications',
        'notification_deliveries',
        'notification_preferences',
        'support_tickets',
        'support_messages',
        'approval_requests',
        'audit_logs',
        'outbox_events',
        'system_settings'
      )
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  9,
  'all operations tables force RLS'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('notifications'),
        ('notification_deliveries'),
        ('notification_preferences'),
        ('support_tickets'),
        ('support_messages'),
        ('approval_requests'),
        ('audit_logs'),
        ('outbox_events'),
        ('system_settings')
    ) as t(table_name)
    where has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'anon table grants match the final RLS surface'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('notifications'),
        ('notification_deliveries'),
        ('notification_preferences'),
        ('support_tickets'),
        ('support_messages'),
        ('approval_requests'),
        ('audit_logs'),
        ('outbox_events'),
        ('system_settings')
    ) as t(table_name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  9,
  'authenticated table grants match the final RLS surface'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'notifications_user_id_fkey'
  ),
  'notifications reference profiles'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'notification_deliveries_notification_id_fkey'
  ),
  'delivery attempts reference notifications'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'notification_deliveries_lifecycle'
      and contype = 'c'
  ),
  'notification delivery lifecycle is constrained'
);

select ok(
  to_regclass(
    'public.notification_deliveries_provider_message_idx'
  ) is not null,
  'provider notification IDs are unique'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'notification_preferences_user_id_fkey'
  ),
  'notification preferences reference profiles'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'notification_preferences_quiet_hours_pair'
      and contype = 'c'
  ),
  'quiet hours require both start and end'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'support_tickets_raised_by_user_id_fkey'
  ),
  'support tickets reference their creator'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'support_tickets_resolution_consistency'
      and contype = 'c'
  ),
  'support resolution fields are constrained'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'support_messages_content_shape'
      and contype = 'c'
  ),
  'support message content matches message type'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.support_messages'::regclass
      and tgname = 'prevent_support_message_mutation'
      and not tgisinternal
  ),
  'support messages are append-only'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'approval_requests_decision_consistency'
      and contype = 'c'
  ),
  'approval request decisions are constrained'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.audit_logs'::regclass
      and tgname = 'prevent_audit_log_mutation'
      and not tgisinternal
  ),
  'audit logs are append-only'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'outbox_events_attempt_limit'
      and contype = 'c'
  ),
  'outbox retries cannot exceed the configured limit'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'outbox_events_lifecycle'
      and contype = 'c'
  ),
  'outbox lifecycle state is constrained'
);

select ok(
  to_regclass('public.outbox_events_pending_idx')
    is not null,
  'pending outbox events have a worker index'
);

select ok(
  to_regprocedure(
    'private.enqueue_outbox_event(text,text,uuid,jsonb,timestamptz,timestamptz)'
  ) is not null,
  'trusted outbox enqueue function exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.enqueue_outbox_event(text,text,uuid,jsonb,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'anonymous users cannot enqueue outbox events'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.enqueue_outbox_event(text,text,uuid,jsonb,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'authenticated users cannot enqueue outbox events directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'private.enqueue_outbox_event(text,text,uuid,jsonb,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'service role can enqueue outbox events'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid =
      'public.order_status_history'::regclass
      and tgname = 'enqueue_order_status_event'
      and not tgisinternal
  ),
  'order status history produces outbox events'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid =
      'public.return_status_history'::regclass
      and tgname = 'enqueue_return_status_event'
      and not tgisinternal
  ),
  'return status history produces outbox events'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.support_messages'::regclass
      and tgname = 'enqueue_support_message_event'
      and not tgisinternal
  ),
  'support messages produce outbox events'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'system_settings_scope_shape'
      and contype = 'c'
  ),
  'system setting scope values are constrained'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'system_settings_value_shape'
      and contype = 'c'
  ),
  'system setting JSON values match their type'
);

select ok(
  to_regclass('public.system_settings_scope_key_idx')
    is not null,
  'system settings are unique per scope'
);

select * from finish();

rollback;
