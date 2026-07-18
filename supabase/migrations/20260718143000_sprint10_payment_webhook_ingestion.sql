create or replace function public.ingest_verified_payment_event(
  p_provider_event_id text,
  p_event_type text,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount_paise bigint,
  p_currency text,
  p_occurred_at timestamptz,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_event public.payment_events;
  v_inserted boolean := false;
  v_stored_payload jsonb;
  v_result jsonb;
begin
  if nullif(btrim(p_provider_event_id), '') is null
    or length(p_provider_event_id) > 256
    or p_event_type not in (
      'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_USER_DROPPED'
    )
    or nullif(btrim(p_provider_order_id), '') is null
    or nullif(btrim(p_provider_payment_id), '') is null
    or p_amount_paise is null or p_amount_paise < 1
    or p_currency <> 'INR'
    or p_occurred_at is null
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;

  select * into v_payment
  from public.payments
  where provider = 'cashfree'
    and provider_order_id = btrim(p_provider_order_id)
  for update;

  if found and (
    v_payment.amount_paise <> p_amount_paise
    or v_payment.currency <> p_currency
  ) then
    raise exception 'FINANCE_PAYMENT_AMOUNT_MISMATCH';
  end if;

  v_stored_payload := p_payload || jsonb_build_object(
    '_vastra', jsonb_build_object(
      'providerOrderId', btrim(p_provider_order_id),
      'providerPaymentId', btrim(p_provider_payment_id),
      'amountPaise', p_amount_paise,
      'currency', p_currency,
      'occurredAt', p_occurred_at
    )
  );

  insert into public.payment_events(
    payment_id,
    provider,
    provider_event_id,
    event_type,
    payload,
    signature_valid,
    processing_status,
    received_at
  ) values (
    v_payment.id,
    'cashfree',
    btrim(p_provider_event_id),
    p_event_type,
    v_stored_payload,
    true,
    'RECEIVED',
    transaction_timestamp()
  )
  on conflict (provider, provider_event_id) do nothing
  returning * into v_event;

  if found then
    v_inserted := true;
  else
    select * into strict v_event
    from public.payment_events
    where provider = 'cashfree'
      and provider_event_id = btrim(p_provider_event_id)
    for update;

    if v_event.event_type <> p_event_type
      or v_event.signature_valid is not true
      or v_event.payload <> v_stored_payload then
      raise exception 'FINANCE_IDEMPOTENCY_CONFLICT';
    end if;
  end if;

  if v_inserted and v_event.payment_id is not null then
    perform private.enqueue_outbox_event(
      'payment.webhook.received',
      'PAYMENT',
      v_event.payment_id,
      jsonb_build_object(
        'paymentEventId', v_event.id::text,
        'providerEventId', v_event.provider_event_id,
        'paymentId', v_event.payment_id,
        'eventType', v_event.event_type,
        'occurredAt', p_occurred_at
      ),
      transaction_timestamp(),
      transaction_timestamp()
    );
  end if;

  v_result := jsonb_build_object(
    'eventId', v_event.id::text,
    'providerEventId', v_event.provider_event_id,
    'paymentId', v_event.payment_id,
    'processingStatus', v_event.processing_status,
    'replayed', not v_inserted
  );
  return v_result;
end;
$$;

revoke all on function public.ingest_verified_payment_event(
  text,text,text,text,bigint,text,timestamptz,jsonb
) from public, anon, authenticated;
grant execute on function public.ingest_verified_payment_event(
  text,text,text,text,bigint,text,timestamptz,jsonb
) to service_role;
