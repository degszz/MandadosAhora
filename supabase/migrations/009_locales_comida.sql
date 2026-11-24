-- ============================================================================
-- 009 — Directorio de locales de comida ("¿Qué comemos?")
-- Mandados Ahora solo muestra el local y sus contactos; el pedido se hace
-- directo con el local.
-- ============================================================================

create table if not exists mandados.locales_comida (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(nombre) between 1 and 80),
  categoria       text not null,                 -- "Hamburguesas", "Pizzas", ...
  descripcion     text check (length(descripcion) <= 200),
  logo_url        text,
  web_url         text,
  whatsapp        text,                          -- solo dígitos, ej 2271415182
  instagram       text,                          -- usuario sin @
  delivery_propio boolean not null default false,
  horario         jsonb,                         -- mismo formato que business_schedule
  activo          boolean not null default true,
  orden           integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists locales_comida_activo_idx
  on mandados.locales_comida (activo, orden);

alter table mandados.locales_comida enable row level security;

-- Lectura pública solo de locales activos
drop policy if exists "locales_read_public" on mandados.locales_comida;
create policy "locales_read_public"
  on mandados.locales_comida for select
  to public
  using (activo = true or mandados.is_admin());

-- Escritura: solo admin
drop policy if exists "locales_write_admin" on mandados.locales_comida;
create policy "locales_write_admin"
  on mandados.locales_comida for all
  to authenticated
  using (mandados.is_admin())
  with check (mandados.is_admin());

grant select on mandados.locales_comida to anon, authenticated;
grant insert, update, delete on mandados.locales_comida to authenticated;
