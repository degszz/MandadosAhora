-- 019: el total de un pedido con MercadoPago no puede ser menor que
-- (cantidad de servicios × costo de envío más barato). create-payment cobra
-- total_amount del pedido, así que esto evita que alguien cree un pedido con
-- un total trucho para pagar menos. Efectivo se cobra en mano: no se exige.

create or replace function mandados.min_order_total(p_items jsonb)
returns numeric
language sql stable security definer
set search_path = mandados, public
as $$
  select greatest(
    case when jsonb_typeof(p_items) = 'array' then jsonb_array_length(p_items) else 0 end, 1)
    * least(
        coalesce((select (value)::numeric from mandados.settings
                   where key = 'service_fee_online' and jsonb_typeof(value) = 'number'), 2500),
        coalesce((select (value)::numeric from mandados.settings
                   where key = 'service_fee_offline' and jsonb_typeof(value) = 'number'), 3500))
$$;
grant execute on function mandados.min_order_total(jsonb) to anon, authenticated, service_role;

drop policy if exists orders_insert_nuevo on mandados.orders;
create policy orders_insert_nuevo on mandados.orders
  for insert to anon, authenticated
  with check (
    status = 'pendiente'
    and payment_status = 'pendiente'
    and repartidor_id is null
    and coalesce(platform_fee_paid, false) = false
    and coalesce(paid_to_repartidor, false) = false
    and (
      payment_method is distinct from 'mercadopago'
      or total_amount >= mandados.min_order_total(items)
    )
  );
