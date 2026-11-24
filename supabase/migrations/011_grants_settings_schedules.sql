-- ============================================================================
-- 011 — Grants faltantes en settings y schedules
-- Las tablas tenían RLS y policies, pero ningún rol tenía GRANT. Resultado:
-- la home no podía leer online/offline ni horarios, y el admin no podía
-- guardar el toggle ni los horarios (fallaba en silencio).
-- Las policies siguen limitando: lectura pública, escritura solo admin.
-- ============================================================================

grant select on mandados.settings  to anon, authenticated;
grant select on mandados.schedules to anon, authenticated;
grant insert, update, delete on mandados.settings  to authenticated;
grant insert, update, delete on mandados.schedules to authenticated;
