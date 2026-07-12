-- Vastra catalogue, products, variants, media, and barcodes.
--
-- Inventory state is deliberately separated into the following ordered
-- migration. Product discovery permissions and merchant write policies are
-- added later in the dedicated RLS migration.

create type public.product_gender_category as enum (
  'MEN',
  'WOMEN',
  'KIDS',
  'UNISEX'
);

create type public.product_moderation_status as enum (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CORRECTION_REQUIRED'
);

create type public.product_image_type as enum (
  'FRONT',
  'BACK',
  'SIDE',
  'DETAIL',
  'MODEL',
  'SIZE_CHART'
);

create type public.barcode_type as enum (
  'EAN13',
  'UPC',
  'CODE128',
  'QR',
  'INTERNAL'
);

create type public.barcode_source as enum (
  'MANUFACTURER',
  'VASTRA_GENERATED',
  'MERCHANT_ENTERED'
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid,
  name text not null,
  slug text not null,
  description text,
  icon_object_key text,
  display_order public.non_negative_quantity not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_parent_id_fkey
    foreign key (parent_id)
    references public.categories (id)
    on update cascade
    on delete set null,

  constraint categories_slug_key
    unique (slug),

  constraint categories_name_nonempty
    check (length(btrim(name)) > 0),

  constraint categories_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  constraint categories_not_own_parent
    check (
      parent_id is null
      or parent_id <> id
    )
);

comment on table public.categories is
  'Hierarchical catalogue taxonomy for clothing, footwear, and accessories.';

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  category_id uuid not null,
  name text not null,
  slug text not null,
  description text,
  brand text,
  material text,
  gender_category public.product_gender_category
    not null
    default 'UNISEX',
  style_tags text[] not null default '{}'::text[],
  occasion_tags text[] not null default '{}'::text[],
  care_instructions text,
  return_eligible boolean not null default true,
  return_window_days smallint not null default 7,
  moderation_status public.product_moderation_status
    not null
    default 'PENDING',
  is_active boolean not null default true,
  search_vector tsvector generated always as (
    setweight(
      to_tsvector(
        'simple'::regconfig,
        coalesce(name, '')
      ),
      'A'
    )
    ||
    setweight(
      to_tsvector(
        'simple'::regconfig,
        coalesce(brand, '')
      ),
      'B'
    )
    ||
    setweight(
      to_tsvector(
        'simple'::regconfig,
        coalesce(description, '')
      ),
      'C'
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint products_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint products_category_id_fkey
    foreign key (category_id)
    references public.categories (id)
    on update cascade
    on delete restrict,

  constraint products_shop_slug_key
    unique (shop_id, slug),

  constraint products_id_shop_id_key
    unique (id, shop_id),

  constraint products_name_nonempty
    check (length(btrim(name)) > 0),

  constraint products_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  constraint products_brand_nonempty
    check (
      brand is null
      or length(btrim(brand)) > 0
    ),

  constraint products_material_nonempty
    check (
      material is null
      or length(btrim(material)) > 0
    ),

  constraint products_return_window_days_check
    check (return_window_days between 0 and 90),

  constraint products_deleted_after_creation_check
    check (
      deleted_at is null
      or deleted_at >= created_at
    )
);

comment on table public.products is
  'Merchant product record independent of exact colour and size variants.';

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  shop_id uuid not null,
  sku text not null,
  colour_name text,
  colour_hex text,
  size_label text,
  mrp_paise public.money_paise not null,
  selling_price_paise public.money_paise not null,
  cost_price_paise public.money_paise,
  weight_grams integer,
  length_cm numeric(8, 2),
  width_cm numeric(8, 2),
  height_cm numeric(8, 2),
  attributes jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_variants_product_shop_fkey
    foreign key (product_id, shop_id)
    references public.products (id, shop_id)
    on update cascade
    on delete restrict,

  constraint product_variants_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint product_variants_shop_sku_key
    unique (shop_id, sku),

  constraint product_variants_id_product_id_key
    unique (id, product_id),

  constraint product_variants_id_shop_id_key
    unique (id, shop_id),

  constraint product_variants_sku_nonempty
    check (length(btrim(sku)) > 0),

  constraint product_variants_price_check
    check (selling_price_paise <= mrp_paise),

  constraint product_variants_colour_name_nonempty
    check (
      colour_name is null
      or length(btrim(colour_name)) > 0
    ),

  constraint product_variants_colour_hex_format
    check (
      colour_hex is null
      or colour_hex ~ '^#[0-9A-Fa-f]{6}$'
    ),

  constraint product_variants_size_label_nonempty
    check (
      size_label is null
      or length(btrim(size_label)) > 0
    ),

  constraint product_variants_weight_positive
    check (
      weight_grams is null
      or weight_grams > 0
    ),

  constraint product_variants_length_positive
    check (
      length_cm is null
      or length_cm > 0
    ),

  constraint product_variants_width_positive
    check (
      width_cm is null
      or width_cm > 0
    ),

  constraint product_variants_height_positive
    check (
      height_cm is null
      or height_cm > 0
    ),

  constraint product_variants_attributes_object
    check (jsonb_typeof(attributes) = 'object')
);

comment on table public.product_variants is
  'Exact sellable SKU for a product colour, size, and attribute combination.';

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  variant_id uuid,
  storage_object_key text not null,
  thumbnail_object_key text,
  image_type public.product_image_type not null default 'FRONT',
  alt_text text,
  display_order public.non_negative_quantity not null default 0,
  is_primary boolean not null default false,
  width_px integer,
  height_px integer,
  created_at timestamptz not null default now(),

  constraint product_images_product_id_fkey
    foreign key (product_id)
    references public.products (id)
    on update cascade
    on delete restrict,

  constraint product_images_variant_product_fkey
    foreign key (variant_id, product_id)
    references public.product_variants (id, product_id)
    on update cascade
    on delete cascade,

  constraint product_images_storage_object_key_key
    unique (storage_object_key),

  constraint product_images_storage_key_nonempty
    check (length(btrim(storage_object_key)) > 0),

  constraint product_images_thumbnail_key_nonempty
    check (
      thumbnail_object_key is null
      or length(btrim(thumbnail_object_key)) > 0
    ),

  constraint product_images_alt_text_nonempty
    check (
      alt_text is null
      or length(btrim(alt_text)) > 0
    ),

  constraint product_images_width_positive
    check (
      width_px is null
      or width_px > 0
    ),

  constraint product_images_height_positive
    check (
      height_px is null
      or height_px > 0
    )
);

comment on table public.product_images is
  'Ordered product and variant media object references.';

create unique index product_images_one_product_primary_idx
on public.product_images (product_id)
where is_primary
  and variant_id is null;

create unique index product_images_one_variant_primary_idx
on public.product_images (variant_id)
where is_primary
  and variant_id is not null;

create table public.variant_barcodes (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null,
  barcode_value text not null,
  barcode_type public.barcode_type not null default 'CODE128',
  source public.barcode_source not null default 'MERCHANT_ENTERED',
  is_primary boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint variant_barcodes_variant_id_fkey
    foreign key (variant_id)
    references public.product_variants (id)
    on update cascade
    on delete restrict,

  constraint variant_barcodes_created_by_fkey
    foreign key (created_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint variant_barcodes_barcode_value_key
    unique (barcode_value),

  constraint variant_barcodes_value_nonempty
    check (length(btrim(barcode_value)) > 0)
);

comment on table public.variant_barcodes is
  'Manufacturer, merchant-entered, and Vastra-generated variant barcodes.';

create unique index variant_barcodes_one_primary_idx
on public.variant_barcodes (variant_id)
where is_primary;

create trigger set_categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create trigger set_product_variants_updated_at
before update on public.product_variants
for each row
execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.categories force row level security;

alter table public.products enable row level security;
alter table public.products force row level security;

alter table public.product_variants enable row level security;
alter table public.product_variants force row level security;

alter table public.product_images enable row level security;
alter table public.product_images force row level security;

alter table public.variant_barcodes enable row level security;
alter table public.variant_barcodes force row level security;

revoke all privileges
on table
  public.categories,
  public.products,
  public.product_variants,
  public.product_images,
  public.variant_barcodes
from anon, authenticated;
