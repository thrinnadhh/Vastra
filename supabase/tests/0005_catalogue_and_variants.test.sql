begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(52);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'product_gender_category'
  ),
  'MEN,WOMEN,KIDS,UNISEX',
  'product gender categories are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'product_moderation_status'
  ),
  'PENDING,APPROVED,REJECTED,CORRECTION_REQUIRED',
  'product moderation statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'product_image_type'
  ),
  'FRONT,BACK,SIDE,DETAIL,MODEL,SIZE_CHART',
  'product image types are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'barcode_type'
  ),
  'EAN13,UPC,CODE128,QR,INTERNAL',
  'barcode types are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'barcode_source'
  ),
  'MANUFACTURER,VASTRA_GENERATED,MERCHANT_ENTERED',
  'barcode sources are defined'
);

select ok(
  to_regclass('public.categories') is not null,
  'categories table exists'
);

select ok(
  to_regclass('public.products') is not null,
  'products table exists'
);

select ok(
  to_regclass('public.product_variants') is not null,
  'product_variants table exists'
);

select ok(
  to_regclass('public.product_images') is not null,
  'product_images table exists'
);

select ok(
  to_regclass('public.variant_barcodes') is not null,
  'variant_barcodes table exists'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'categories',
        'products',
        'product_variants',
        'product_images',
        'variant_barcodes'
      )
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  5,
  'all catalogue tables force row-level security'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('categories'),
        ('products'),
        ('product_variants'),
        ('product_images'),
        ('variant_barcodes')
    ) as secured_tables(table_name)
    where has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'anonymous clients have no catalogue grants'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('categories'),
        ('products'),
        ('product_variants'),
        ('product_images'),
        ('variant_barcodes')
    ) as secured_tables(table_name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'authenticated clients have no catalogue grants before policies'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'categories_parent_id_fkey'
      and conrelid = 'public.categories'::regclass
      and confrelid = 'public.categories'::regclass
  ),
  'categories support hierarchy'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'categories_slug_key'
      and conrelid = 'public.categories'::regclass
      and contype = 'u'
  ),
  'category slugs are unique'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'categories_not_own_parent'
      and conrelid = 'public.categories'::regclass
      and contype = 'c'
  ),
  'categories cannot be their own parent'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.categories'::regclass
      and attname = 'display_order'
      and atttypid = 'public.non_negative_quantity'::regtype
      and not attisdropped
  ),
  'category display order is non-negative'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.categories'::regclass
      and tgname = 'set_categories_updated_at'
      and not tgisinternal
  ),
  'categories have an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'products_shop_id_fkey'
      and conrelid = 'public.products'::regclass
      and confrelid = 'public.shops'::regclass
  ),
  'products reference shops'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'products_category_id_fkey'
      and conrelid = 'public.products'::regclass
      and confrelid = 'public.categories'::regclass
  ),
  'products reference categories'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'products_shop_slug_key'
      and conrelid = 'public.products'::regclass
      and contype = 'u'
  ),
  'product slugs are unique per shop'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'products_id_shop_id_key'
      and conrelid = 'public.products'::regclass
      and contype = 'u'
  ),
  'products expose a composite product-shop key'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.products'::regclass
      and attname = 'gender_category'
      and atttypid = 'public.product_gender_category'::regtype
      and not attisdropped
  ),
  'products use gender categories'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.products'::regclass
      and attname = 'moderation_status'
      and atttypid = 'public.product_moderation_status'::regtype
      and not attisdropped
  ),
  'products use moderation statuses'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.products'::regclass
      and attname = 'search_vector'
      and attgenerated = 's'
      and not attisdropped
  ),
  'product search vectors are generated'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'products_return_window_days_check'
      and conrelid = 'public.products'::regclass
      and contype = 'c'
  ),
  'product return windows are constrained'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'products_deleted_after_creation_check'
      and conrelid = 'public.products'::regclass
      and contype = 'c'
  ),
  'product soft-deletion timestamps are constrained'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.products'::regclass
      and tgname = 'set_products_updated_at'
      and not tgisinternal
  ),
  'products have an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_product_shop_fkey'
      and conrelid = 'public.product_variants'::regclass
      and confrelid = 'public.products'::regclass
  ),
  'variants must belong to their product shop'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_shop_id_fkey'
      and conrelid = 'public.product_variants'::regclass
      and confrelid = 'public.shops'::regclass
  ),
  'variants reference shops'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_shop_sku_key'
      and conrelid = 'public.product_variants'::regclass
      and contype = 'u'
  ),
  'SKUs are unique per shop'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_id_product_id_key'
      and conrelid = 'public.product_variants'::regclass
      and contype = 'u'
  ),
  'variants expose a composite variant-product key'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_id_shop_id_key'
      and conrelid = 'public.product_variants'::regclass
      and contype = 'u'
  ),
  'variants expose a composite variant-shop key'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.product_variants'::regclass
      and attname = 'mrp_paise'
      and atttypid = 'public.money_paise'::regtype
      and not attisdropped
  ),
  'variant MRP uses integer paise'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.product_variants'::regclass
      and attname = 'selling_price_paise'
      and atttypid = 'public.money_paise'::regtype
      and not attisdropped
  ),
  'variant selling price uses integer paise'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.product_variants'::regclass
      and attname = 'cost_price_paise'
      and atttypid = 'public.money_paise'::regtype
      and not attisdropped
  ),
  'variant cost price uses integer paise'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_price_check'
      and conrelid = 'public.product_variants'::regclass
      and contype = 'c'
  ),
  'selling price cannot exceed MRP'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_colour_hex_format'
      and conrelid = 'public.product_variants'::regclass
      and contype = 'c'
  ),
  'variant colour hex values are constrained'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.product_variants'::regclass
      and attname = 'attributes'
      and atttypid = 'jsonb'::regtype
      and not attisdropped
  ),
  'variant attributes use jsonb'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.product_variants'::regclass
      and tgname = 'set_product_variants_updated_at'
      and not tgisinternal
  ),
  'product variants have an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_images_product_id_fkey'
      and conrelid = 'public.product_images'::regclass
      and confrelid = 'public.products'::regclass
  ),
  'product images reference products'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_images_variant_product_fkey'
      and conrelid = 'public.product_images'::regclass
      and confrelid = 'public.product_variants'::regclass
  ),
  'variant images must belong to their product'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_images_storage_object_key_key'
      and conrelid = 'public.product_images'::regclass
      and contype = 'u'
  ),
  'product image storage keys are unique'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.product_images'::regclass
      and attname = 'image_type'
      and atttypid = 'public.product_image_type'::regtype
      and not attisdropped
  ),
  'product images use image types'
);

select ok(
  to_regclass('public.product_images_one_product_primary_idx')
    is not null,
  'products have at most one primary product-level image'
);

select ok(
  to_regclass('public.product_images_one_variant_primary_idx')
    is not null,
  'variants have at most one primary image'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'variant_barcodes_variant_id_fkey'
      and conrelid = 'public.variant_barcodes'::regclass
      and confrelid = 'public.product_variants'::regclass
  ),
  'barcodes reference variants'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'variant_barcodes_created_by_fkey'
      and conrelid = 'public.variant_barcodes'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'barcode creators reference profiles'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'variant_barcodes_barcode_value_key'
      and conrelid = 'public.variant_barcodes'::regclass
      and contype = 'u'
  ),
  'barcode values are globally unique'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.variant_barcodes'::regclass
      and attname = 'barcode_type'
      and atttypid = 'public.barcode_type'::regtype
      and not attisdropped
  ),
  'variant barcodes use barcode types'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.variant_barcodes'::regclass
      and attname = 'source'
      and atttypid = 'public.barcode_source'::regtype
      and not attisdropped
  ),
  'variant barcodes use barcode sources'
);

select ok(
  to_regclass('public.variant_barcodes_one_primary_idx')
    is not null,
  'variants have at most one primary barcode'
);

select * from finish();

rollback;
