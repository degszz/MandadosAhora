-- 013: cerrar el acceso público a pedidos y mensajes.
-- Antes: el rol anon podía LISTAR todos los pedidos (nombres, direcciones,
-- teléfonos, códigos de entrega) y MODIFICAR cualquiera (anon_update_payment).
-- Ahora: anon solo puede crear un pedido nuevo (pendiente) y consultar uno
-- por ID exacto mediante funciones.

-- 1) Sacar policies abiertas
drop policy if exists anon_read_order_by_id on mandados.orders;
drop policy if exists anon_update_payment on mandados.orders;
drop policy if exists anon_read_messages_by_order on mandados.messages;

-- 2) Crear pedido: solo en estado inicial
drop policy if exists orders_insert_any on mandados.orders;
create policy orders_insert_nuevo on mandados.orders
  for insert to anon, authenticated
  with check (
    status = 'pendiente'
    and payment_status = 'pendiente'
    and repartidor_id is null
    and coalesce(platform_fee_paid, false) = false
    and coalesce(paid_to_repartidor, false) = false
  );

-- 3) Consulta por ID exacto (seguimiento del cliente)
create or replace function mandados.get_order(p_id uuid)
returns setof mandados.orders
language sql stable security definer
set search_path = mandados, public
as $$ select * from mandados.orders where id = p_id $$;

create or replace function mandados.get_order_messages(p_id uuid)
returns setof mandados.messages
language sql stable security definer
set search_path = mandados, public
as $$ select * from mandados.messages where order_id = p_id order by created_at asc $$;

-- 4) Adjuntar comprobante de pago a un pedido propio
create or replace function mandados.set_payment_proof(p_id uuid, p_url text)
returns void
language plpgsql security definer
set search_path = mandados, public
as $$
begin
  if p_url is null or p_url !~ '^https://' then
    raise exception 'URL inválida';
  end if;
  update mandados.orders set payment_proof_url = p_url where id = p_id;
end;
$$;

revoke all on function mandados.get_order(uuid) from public;
revoke all on function mandados.get_order_messages(uuid) from public;
revoke all on function mandados.set_payment_proof(uuid, text) from public;
grant execute on function mandados.get_order(uuid) to anon, authenticated;
grant execute on function mandados.get_order_messages(uuid) to anon, authenticated;
grant execute on function mandados.set_payment_proof(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
