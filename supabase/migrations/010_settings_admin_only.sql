-- ============================================================================
-- 010 — settings: escritura solo para admin
-- La 008 dejaba escribir a cualquier usuario autenticado (incluso
-- repartidores podían poner el sitio offline o cambiar precios).
-- ============================================================================

drop policy if exists "settings_write_authenticated" on mandados.settings;
drop policy if exists "settings_admin_update" on mandados.settings;
drop policy if exists "settings_write_admin" on mandados.settings;

create policy "settings_write_admin"
  on mandados.settings for all
  to authenticated
  using (mandados.is_admin())
  with check (mandados.is_admin());
