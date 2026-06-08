-- ============================================================================
-- Schema inicial: Mandados Ahora
-- Schema: mandados (para cohabitar con otro proyecto en el mismo Supabase)
-- ============================================================================

-- 1. Schema
create schema if not exists mandados;

-- 2. Extensiones
create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================================================
-- 3. Tablas
-- ============================================================================

-- 3.1 profiles — 1:1 con auth.users, creada por trigger al signup
create table mandados.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  avatar_url  text,
  role        text not null default 'repartidor'
              check (role in ('admin', 'repartidor')),
  verified    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.2 orders — pedidos creados desde checkout y audio
create table mandados.orders (
  id                uuid primary key default uuid_generate_v4(),
  customer_name     text,
  customer_email    text,
  items             jsonb not null default '[]'::jsonb,
  address           text default '',
  address_lat       double precision,
  address_lng       double precision,
  payment_method    text not null default 'efectivo',
  payment_status    text not null default 'pendiente',
  status            text not null default 'pendiente',
  delivery_code     text,
  total_amount      numeric(10,2),
  driver_commission numeric(10,2),
  services_count    int default 1,
  repartidor_id     uuid references mandados.profiles(id),
  audio_url         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 3.3 messages — chat realtime por pedido
create table mandados.messages (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references mandados.orders(id) on delete cascade,
  sender_id   uuid references mandados.profiles(id),
  sender_role text not null default 'cliente'
              check (sender_role in ('cliente', 'repartidor', 'admin')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- 3.4 settings — key-value para flags de negocio
create table mandados.settings (
  key         text primary key,
  value       jsonb not null default 'null'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 3.5 schedules — horarios por servicio
create table mandados.schedules (
  id            uuid primary key default uuid_generate_v4(),
  service_name  text not null,
  service_slug  text not null unique,
  monday_open   text,
  monday_close  text,
  tuesday_open  text,
  tuesday_close text,
  wednesday_open   text,
  wednesday_close  text,
  thursday_open    text,
  thursday_close   text,
  friday_open      text,
  friday_close     text,
  saturday_open    text,
  saturday_close   text,
  sunday_open      text,
  sunday_close     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================================
-- 4. Índices
-- ============================================================================

create index idx_orders_status       on mandados.orders(status);
create index idx_orders_repartidor   on mandados.orders(repartidor_id);
create index idx_orders_created      on mandados.orders(created_at desc);
create index idx_messages_order      on mandados.messages(order_id);
create index idx_messages_created    on mandados.messages(created_at);
create index idx_schedules_slug      on mandados.schedules(service_slug);
create index idx_profiles_role       on mandados.profiles(role);

-- ============================================================================
-- 5. Funciones
-- ============================================================================

-- 5.1 handle_new_user — crea profile automáticamente al hacer signup
create or replace function mandados.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = mandados
as $$
begin
  insert into mandados.profiles (id, email, full_name, avatar_url, role, verified)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when new.email = 'maxxfiguera765@gmail.com' then 'admin'
      else 'repartidor'
    end,
    case
      when new.email = 'maxxfiguera765@gmail.com' then true
      else false
    end
  );
  return new;
end;
$$;

-- 5.2 claim_order — atomic claim de pedido (first-wins)
create or replace function mandados.claim_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = mandados
as $$
begin
  update mandados.orders
  set
    status = 'confirmado',
    repartidor_id = auth.uid(),
    updated_at = now()
  where id = p_order_id
    and status = 'pendiente'
    and repartidor_id is null;

  if not found then
    raise exception 'Pedido ya fue tomado por otro repartidor o no existe.';
  end if;
end;
$$;

-- 5.3 is_admin — helper para RLS
create or replace function mandados.is_admin()
returns boolean
language sql
stable
security definer
set search_path = mandados
as $$
  select exists (
    select 1 from mandados.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 5.4 is_verified_repartidor — helper para RLS
create or replace function mandados.is_verified_repartidor()
returns boolean
language sql
stable
security definer
set search_path = mandados
as $$
  select exists (
    select 1 from mandados.profiles
    where id = auth.uid()
      and role = 'repartidor'
      and verified = true
  );
$$;

-- ============================================================================
-- 6. Trigger on auth.users → crea profile
-- ============================================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function mandados.handle_new_user();

-- ============================================================================
-- 7. Row Level Security
-- ============================================================================

alter table mandados.profiles  enable row level security;
alter table mandados.orders    enable row level security;
alter table mandados.messages  enable row level security;
alter table mandados.settings  enable row level security;
alter table mandados.schedules enable row level security;

-- --------------------------------------------------------------------------
-- 7.1 profiles
-- --------------------------------------------------------------------------

-- Todos los autenticados pueden leer perfiles (necesario para el chat)
create policy "Authenticated can read profiles"
  on mandados.profiles for select
  using (auth.role() = 'authenticated');

-- Cada uno puede leer su propio perfil aunque no esté autenticado
create policy "Users can read own profile"
  on mandados.profiles for select
  using (auth.uid() = id);

-- Admin puede modificar cualquier perfil
create policy "Admin can update profiles"
  on mandados.profiles for update
  using (mandados.is_admin())
  with check (mandados.is_admin());

-- Admin puede borrar perfiles
create policy "Admin can delete profiles"
  on mandados.profiles for delete
  using (mandados.is_admin());

-- --------------------------------------------------------------------------
-- 7.2 orders
-- --------------------------------------------------------------------------

-- Anon (checkout público) puede insertar pedidos
create policy "Anon can insert orders"
  on mandados.orders for insert
  with check (true);

-- Repartidores y admin pueden leer todos los pedidos
create policy "Repartidor and admin can read orders"
  on mandados.orders for select
  using (
    mandados.is_admin()
    or mandados.is_verified_repartidor()
    or auth.role() = 'anon'
  );

-- Repartidor asignado y admin pueden actualizar pedidos
create policy "Repartidor and admin can update orders"
  on mandados.orders for update
  using (
    mandados.is_admin()
    or (mandados.is_verified_repartidor() and repartidor_id = auth.uid())
  )
  with check (true);

-- Solo admin puede borrar pedidos
create policy "Admin can delete orders"
  on mandados.orders for delete
  using (mandados.is_admin());

-- --------------------------------------------------------------------------
-- 7.3 messages
-- --------------------------------------------------------------------------

-- Cliente puede leer mensajes de su pedido, repartidor/admin todos
create policy "Read messages by role"
  on mandados.messages for select
  using (
    mandados.is_admin()
    or mandados.is_verified_repartidor()
    or auth.role() = 'anon'
  );

-- Cualquiera puede insertar mensajes (anon para cliente, auth para admin/repartidor)
create policy "Insert messages"
  on mandados.messages for insert
  with check (true);

-- Solo admin puede borrar mensajes
create policy "Admin can delete messages"
  on mandados.messages for delete
  using (mandados.is_admin());

-- --------------------------------------------------------------------------
-- 7.4 settings
-- --------------------------------------------------------------------------

-- Cualquiera puede leer settings (público)
create policy "Anyone can read settings"
  on mandados.settings for select
  using (true);

-- Solo admin puede modificar settings
create policy "Admin can manage settings"
  on mandados.settings for all
  using (mandados.is_admin())
  with check (mandados.is_admin());

-- --------------------------------------------------------------------------
-- 7.5 schedules
-- --------------------------------------------------------------------------

-- Cualquiera puede leer schedules (público)
create policy "Anyone can read schedules"
  on mandados.schedules for select
  using (true);

-- Solo admin puede modificar schedules
create policy "Admin can manage schedules"
  on mandados.schedules for all
  using (mandados.is_admin())
  with check (mandados.is_admin());

-- ============================================================================
-- 8. Realtime — habilitar para orders y messages
-- ============================================================================

-- Asegura que las tablas estén en la publicación de realtime
-- (Requiere que supabase_realtime publication ya exista)
do $$
begin
  -- La publication supabase_realtime es creada por Supabase automáticamente
  -- Solo agregamos las tablas que nos interesan
  begin
    alter publication supabase_realtime add table mandados.orders;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table mandados.messages;
  exception when duplicate_object then null;
  end;
end;
$$;

-- ============================================================================
-- 9. Storage bucket: audio-pedidos
-- ============================================================================

-- NOTE: Esto debe ejecutarse como admin vía dashboard o MCP porque
-- Storage buckets no se crean con SQL (están en el API de Storage).
-- El MCP server lo va a crear automáticamente.
-- Bucket: audio-pedidos (público), file size limit 5MB, allowed mime: audio/*

-- ============================================================================
-- 10. Datos iniciales
-- ============================================================================

-- Settings defaults
insert into mandados.settings (key, value) values
  ('business_open', 'true'::jsonb),
  ('business_schedule', 'null'::jsonb),
  ('hiring_active', 'false'::jsonb)
on conflict (key) do nothing;

-- Schedules iniciales (vacías — el admin las configura desde el panel)
-- Se crean rows para cada servicio conocido
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
  ('Ferretería',  'ferreteria')
on conflict (service_slug) do nothing;
