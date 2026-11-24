-- ============================================================================
-- 003 — Corregir columnas de schedules para que matcheen con el frontend
-- ============================================================================

-- Las columnas viejas (per-day: monday_open, monday_close, etc.) no coincidian
-- con lo que el frontend manda (is_open, open_time, close_time, days_open).
-- PostgREST ignora columnas desconocidas, asi que los saves funcionaban
-- silenciosamente sin persistir nada.

-- 1. Borrar columnas viejas
alter table mandados.schedules
  drop column if exists monday_open,
  drop column if exists monday_close,
  drop column if exists tuesday_open,
  drop column if exists tuesday_close,
  drop column if exists wednesday_open,
  drop column if exists wednesday_close,
  drop column if exists thursday_open,
  drop column if exists thursday_close,
  drop column if exists friday_open,
  drop column if exists friday_close,
  drop column if exists saturday_open,
  drop column if exists saturday_close,
  drop column if exists sunday_open,
  drop column if exists sunday_close;

-- 2. Agregar columnas nuevas (matchean con HorariosPanel.update + save)
alter table mandados.schedules
  add column if not exists is_open    boolean not null default false,
  add column if not exists open_time  time,
  add column if not exists close_time time,
  add column if not exists days_open  text[] not null default '{}';

-- 3. Limpiar datos viejos y re-insertar con defaults correctos
delete from mandados.schedules;

insert into mandados.schedules (service_name, service_slug) values
  ('Mercado',     'mercado'),
  ('Carnicería',  'carniceria'),
  ('Farmacia',    'farmacia'),
  ('24 Horas',    '24horas'),
  ('Verdulería',  'verduleria'),
  ('Librería',    'libreria'),
  ('Licorería',   'licoreria'),
  ('Lavandería',  'lavanderia'),
  ('Panadería',   'panaderia'),
  ('Heladería',   'heladeria'),
  ('Pescadería',  'pescaderia'),
  ('Sin TACC',    'sintacc'),
  ('Dietética',   'dietetica'),
  ('Ferretería',  'ferreteria'),
  ('Pollería',    'polleria');
