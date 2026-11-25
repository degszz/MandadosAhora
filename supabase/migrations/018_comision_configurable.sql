-- 018: porcentaje de comisión configurable desde el admin.
-- settings.platform_fee_pct (número, 0–50). El trigger de 016/017 deja de usar
-- 15 fijo y lee este valor. Los costos de envío ya estaban en settings
-- (service_fee_online / service_fee_offline).

insert into mandados.settings (key, value)
values ('platform_fee_pct', '15'::jsonb)
on conflict (key) do nothing;

-- Porcentaje vigente; 15 si falta o es inválido.
create or replace function mandados.platform_fee_pct()
returns numeric
language sql stable security definer
set search_path = mandados, public
as $$
  select coalesce(
    (select case when jsonb_typeof(value) = 'number'
                  and (value)::numeric between 0 and 50
                 then (value)::numeric end
       from mandados.settings where key = 'platform_fee_pct'),
    15)
$$;
grant execute on function mandados.platform_fee_pct() to anon, authenticated, service_role;

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

  if new.platform_fee_paid is distinct from old.platform_fee_paid then
    raise exception 'Solo el administrador puede cambiar el estado de la comisión';
  end if;
  if new.paid_to_repartidor is distinct from old.paid_to_repartidor
     or new.payment_status is distinct from old.payment_status
     or new.paid_at is distinct from old.paid_at
     or new.payment_reference is distinct from old.payment_reference
     or new.total_amount is distinct from old.total_amount then
    raise exception 'Campos de pago solo editables por el administrador';
  end if;

  if coalesce(old.platform_fee_paid, false)
     and new.purchase_amount is distinct from old.purchase_amount then
    raise exception 'La comisión ya está paga: no se puede cambiar el monto de la compra';
  end if;
  if new.purchase_amount is not null and new.purchase_amount <= 0 then
    raise exception 'El monto de la compra tiene que ser mayor a cero';
  end if;

  new.platform_fee := case
    when new.purchase_amount is null then null
    else round(new.purchase_amount * mandados.platform_fee_pct() / 100)
  end;
  return new;
end;
$$;
