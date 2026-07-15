-- S5A-07: batch hydrate Saved Look sources from current Wardrobe/catalogue/inventory state.

create or replace function public.resolve_saved_look_items(p_actor uuid,p_look_ids uuid[])
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare result jsonb;
begin
  if p_actor is null or p_look_ids is null or cardinality(p_look_ids)<1 or cardinality(p_look_ids)>100 then
    raise exception 'look resolution request invalid' using errcode='22023';
  end if;
  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;
  if (select count(distinct look.id) from public.saved_looks look where look.id=any(p_look_ids) and look.owner_customer_id=p_actor)
    <> (select count(distinct value) from unnest(p_look_ids) value) then
    raise exception 'saved look not found' using errcode='P0030';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'savedLookItemId',item.id,
    'wardrobeObjectKey',case
      when item.item_type='WARDROBE_ITEM'
        and wardrobe.status='ACTIVE'
        and wardrobe.owner_customer_id=p_actor
      then wardrobe.storage_object_key else null end,
    'productImageObjectKey',case when item.item_type='PRODUCT_VARIANT' then image.image_object_key else null end,
    'currentSellingPricePaise',case when item.item_type='PRODUCT_VARIANT' then variant.selling_price_paise else null end,
    'availableQuantity',case when item.item_type='PRODUCT_VARIANT' then
      case when variant.is_active
        and product.is_active and product.deleted_at is null and product.moderation_status='APPROVED'
        and shop.verification_status='VERIFIED' and shop.accepts_online_orders
        and shop.operational_status in('OPEN','BUSY')
      then greatest(coalesce(balance.stock_on_hand-balance.reserved_quantity-balance.damaged_quantity,0),0)
      else 0 end
    else null end
  ) order by item.look_id,item.display_position),'[]'::jsonb)
  into result
  from public.saved_look_items item
  join public.saved_looks look on look.id=item.look_id and look.owner_customer_id=p_actor
  left join public.wardrobe_items wardrobe on wardrobe.id=item.wardrobe_item_id
  left join public.product_variants variant on variant.id=item.product_variant_id
  left join public.products product on product.id=variant.product_id
  left join public.shops shop on shop.id=variant.shop_id
  left join public.inventory_balances balance on balance.shop_id=variant.shop_id and balance.variant_id=variant.id
  left join lateral (
    select coalesce(product_image.thumbnail_object_key,product_image.storage_object_key) image_object_key
    from public.product_images product_image
    where product_image.product_id=product.id
      and (product_image.variant_id=variant.id or product_image.variant_id is null)
    order by (product_image.variant_id=variant.id) desc,product_image.is_primary desc,product_image.display_order,product_image.id
    limit 1
  ) image on true
  where item.look_id=any(p_look_ids);
  return result;
end;
$$;
revoke all on function public.resolve_saved_look_items(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.resolve_saved_look_items(uuid,uuid[]) to service_role;
