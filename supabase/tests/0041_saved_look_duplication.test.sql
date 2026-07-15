begin;
select plan(5);
select has_table('private','saved_look_duplicate_requests','durable duplicate receipts exist');
select has_function('public','duplicate_saved_look',array['uuid','uuid','text','uuid'],'duplicate function exists');
select function_privs_are('public','duplicate_saved_look',array['uuid','uuid','text','uuid'],'authenticated',array[]::text[],'client cannot bypass duplication authorization');
select function_privs_are('public','duplicate_saved_look',array['uuid','uuid','text','uuid'],'service_role',array['EXECUTE'],'backend can duplicate');
select isnt_empty($$select 1 from pg_proc where proname='duplicate_saved_look' and prosrc like '%gen_random_uuid%'$$,'child IDs are regenerated');
select * from finish();
rollback;
