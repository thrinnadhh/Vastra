-- S3-04 product image management.
--
-- Product media is publicly readable after upload, but all upload intents and
-- metadata writes remain trusted backend operations. Merchant clients retain
-- read-only RLS access to owned product image metadata.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'catalogue-media',
  'catalogue-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.catalogue_create_product_image(
  p_shop_id uuid,
  p_product_id uuid,
  p_storage_object_key text,
  p_image_type public.product_image_type,
  p_alt_text text,
  p_display_order integer,
  p_is_primary boolean,
  p_width_px integer,
  p_height_px integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_image public.product_images%rowtype;
  v_make_primary boolean;
  v_prefix text;
begin
  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.shop_id = p_shop_id
      and p.deleted_at is null
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'PRODUCT_NOT_FOUND';
  end if;

  v_prefix := format('catalogue/%s/%s/', p_shop_id, p_product_id);

  if p_storage_object_key is null
    or p_storage_object_key not like v_prefix || '%'
    or position('..' in p_storage_object_key) > 0
    or right(p_storage_object_key, 1) = '/'
  then
    raise exception using
      errcode = '22023',
      message = 'PRODUCT_IMAGE_OBJECT_KEY_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));

  v_make_primary := p_is_primary or not exists (
    select 1
    from public.product_images pi
    where pi.product_id = p_product_id
      and pi.variant_id is null
      and pi.is_primary
  );

  if v_make_primary then
    update public.product_images
    set is_primary = false
    where product_id = p_product_id
      and variant_id is null
      and is_primary;
  end if;

  insert into public.product_images (
    product_id,
    variant_id,
    storage_object_key,
    thumbnail_object_key,
    image_type,
    alt_text,
    display_order,
    is_primary,
    width_px,
    height_px
  )
  values (
    p_product_id,
    null,
    p_storage_object_key,
    null,
    p_image_type,
    p_alt_text,
    p_display_order,
    v_make_primary,
    p_width_px,
    p_height_px
  )
  returning *
  into v_image;

  return to_jsonb(v_image);
end;
$$;

create or replace function public.catalogue_update_product_image(
  p_shop_id uuid,
  p_product_id uuid,
  p_image_id uuid,
  p_image_type public.product_image_type,
  p_alt_text text,
  p_display_order integer,
  p_is_primary boolean,
  p_width_px integer,
  p_height_px integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_image public.product_images%rowtype;
begin
  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.shop_id = p_shop_id
      and p.deleted_at is null
  ) then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));

  select *
  into v_image
  from public.product_images pi
  where pi.id = p_image_id
    and pi.product_id = p_product_id
    and pi.variant_id is null
  for update;

  if not found then
    return null;
  end if;

  if p_is_primary then
    update public.product_images
    set is_primary = false
    where product_id = p_product_id
      and variant_id is null
      and id <> p_image_id
      and is_primary;
  end if;

  update public.product_images
  set
    image_type = p_image_type,
    alt_text = p_alt_text,
    display_order = p_display_order,
    is_primary = p_is_primary,
    width_px = p_width_px,
    height_px = p_height_px
  where id = p_image_id
  returning *
  into v_image;

  return to_jsonb(v_image);
end;
$$;

create or replace function public.catalogue_delete_product_image(
  p_shop_id uuid,
  p_product_id uuid,
  p_image_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deleted public.product_images%rowtype;
  v_next_id uuid;
begin
  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.shop_id = p_shop_id
      and p.deleted_at is null
  ) then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));

  delete from public.product_images pi
  where pi.id = p_image_id
    and pi.product_id = p_product_id
    and pi.variant_id is null
  returning *
  into v_deleted;

  if not found then
    return null;
  end if;

  if v_deleted.is_primary then
    select pi.id
    into v_next_id
    from public.product_images pi
    where pi.product_id = p_product_id
      and pi.variant_id is null
    order by
      pi.display_order asc,
      pi.created_at asc,
      pi.id asc
    limit 1
    for update;

    if v_next_id is not null then
      update public.product_images
      set is_primary = true
      where id = v_next_id;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_deleted.id,
    'storage_object_key', v_deleted.storage_object_key,
    'thumbnail_object_key', v_deleted.thumbnail_object_key
  );
end;
$$;

revoke all
on function public.catalogue_create_product_image(
  uuid,
  uuid,
  text,
  public.product_image_type,
  text,
  integer,
  boolean,
  integer,
  integer
)
from public, anon, authenticated;

revoke all
on function public.catalogue_update_product_image(
  uuid,
  uuid,
  uuid,
  public.product_image_type,
  text,
  integer,
  boolean,
  integer,
  integer
)
from public, anon, authenticated;

revoke all
on function public.catalogue_delete_product_image(uuid, uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.catalogue_create_product_image(
  uuid,
  uuid,
  text,
  public.product_image_type,
  text,
  integer,
  boolean,
  integer,
  integer
)
to service_role;

grant execute
on function public.catalogue_update_product_image(
  uuid,
  uuid,
  uuid,
  public.product_image_type,
  text,
  integer,
  boolean,
  integer,
  integer
)
to service_role;

grant execute
on function public.catalogue_delete_product_image(uuid, uuid, uuid)
to service_role;

comment on function public.catalogue_create_product_image(
  uuid,
  uuid,
  text,
  public.product_image_type,
  text,
  integer,
  boolean,
  integer,
  integer
) is
  'Creates product-level image metadata and serializes primary-image selection.';

comment on function public.catalogue_update_product_image(
  uuid,
  uuid,
  uuid,
  public.product_image_type,
  text,
  integer,
  boolean,
  integer,
  integer
) is
  'Replaces product-level image metadata and atomically switches primary image.';

comment on function public.catalogue_delete_product_image(uuid, uuid, uuid) is
  'Deletes product-level image metadata and promotes the next ordered image when necessary.';
