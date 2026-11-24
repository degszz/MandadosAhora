-- 016: proteger campos de pago.
-- a) Un repartidor podía marcar platform_fee_paid / paid_to_repartidor /
--    payment_status directo con su policy de UPDATE. Ahora solo admin o el
--    webhook (service_role) pueden cambiarlos, y la comisión se calcula acá.
-- b) set_payment_proof solo para pedidos pendientes, sin comprobante previo y
--    con URL del bucket comprobantes de este proyecto.

create or replace function mandados.proteger_campos_pago()
returns trigger
language plpgsql security invoker  -- invoker: current_user tiene que ser el rol real que escribe
set search_path = mandados, public
as $$
begin
  -- admin, webhook (service_role) y funciones security definer (corren como postgres) pasan
  if mandados.is_admin() or current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if new.platform_fee_paid is distinct from old.platform_fee_paid and coalesce(new.platform_fee_paid, false) then
    raise exception 'Solo el administrador puede marcar la comisión como paga';
  end if;
  if new.paid_to_repartidor is distinct from old.paid_to_repartidor
     or new.payment_status is distinct from old.payment_status
     or new.paid_at is distinct from old.paid_at
     or new.payment_reference is distinct from old.payment_reference
     or new.total_amount is distinct from old.total_amount then
    raise exception 'Campos de pago solo editables por el administrador';
  end if;

  -- La comisión siempre es el 15% de la compra declarada en el ticket
  if new.purchase_amount is not null then
    new.platform_fee := round(new.purchase_amount * 0.15);
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_campos_pago on mandados.orders;
create trigger proteger_campos_pago
  before update on mandados.orders
  for each row execute function mandados.proteger_campos_pago();

create or replace function mandados.set_payment_proof(p_id uuid, p_url text)
returns void
language plpgsql security definer
set search_path = mandados, public
as $$
begin
  if p_url is null
     or p_url not like 'https://aiagaddxujtbyudriulh.supabase.co/storage/v1/object/public/comprobantes/%' then
    raise exception 'URL inválida';
  end if;
  update mandados.orders
     set payment_proof_url = p_url
   where id = p_id
     and payment_status = 'pendiente'
     and payment_proof_url is null;
end;
$$;
