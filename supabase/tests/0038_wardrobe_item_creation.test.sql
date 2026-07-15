begin;
select plan(13);

select has_table('public', 'wardrobe_items', 'wardrobe_items exists');
select has_column('public', 'wardrobe_items', 'storage_object_key', 'private key is persisted');
select col_is_pk('public', 'wardrobe_items', 'id', 'wardrobe item id is primary key');
select has_index('public', 'wardrobe_items', 'wardrobe_items_owner_status_created_idx', 'owner list index exists');
select table_privs_are(
  'public', 'wardrobe_items', 'authenticated', array[]::text[],
  'authenticated cannot read private keys or mutate wardrobe metadata directly'
);
select has_function('public', 'finalize_wardrobe_item', array['uuid','uuid','text','text','text','text','text','uuid'], 'finalization function exists');
select function_privs_are(
  'public', 'finalize_wardrobe_item', array['uuid','uuid','text','text','text','text','text','uuid'],
  'authenticated', array[]::text[], 'clients cannot execute trusted finalization'
);
select function_privs_are(
  'public', 'finalize_wardrobe_item', array['uuid','uuid','text','text','text','text','text','uuid'],
  'service_role', array['EXECUTE'], 'backend can execute trusted finalization'
);
select has_table('private', 'wardrobe_item_create_requests', 'durable finalization receipts exist');
select col_is_pk('private', 'wardrobe_item_create_requests', array['customer_id','idempotency_key'], 'receipt key serializes replays');
select policies_are('public', 'wardrobe_items', array['wardrobe_items_no_direct_access']::text[], 'direct client table access is denied');
select isnt_empty(
  $$select 1 from pg_constraint where conname = 'wardrobe_items_deleted_shape_check'$$,
  'active/deleted lifecycle is constrained'
);
select isnt_empty(
  $$select 1 from pg_proc where proname = 'build_wardrobe_item_payload'$$,
  'internal payload builder exists'
);

select * from finish();
rollback;
