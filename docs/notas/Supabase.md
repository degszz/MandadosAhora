# Supabase

Volver: [[00 Inicio]]

- Proyecto **cloudweb**, ID `aiagaddxujtbyudriulh`, región `sa-east-1`. Compartido con otra app: todo lo nuestro vive en el schema **`mandados`** (debe estar en *Exposed schemas*).
- Plan gratis: **se pausa solo por inactividad**. Si el sitio no carga datos, revisar primero si está pausado (dashboard → Restore).
- Cliente: `src/scripts/supabase.js` → `getSupabase()` con `db.schema = "mandados"` y `storageKey: "mandados-auth-token"`.
- REST sin cliente (home): headers `apikey`, `Authorization: Bearer <anon>`, `Accept-Profile: mandados`.

## Tablas
| Tabla | Para qué |
|---|---|
| `profiles` | Usuarios. `role`: admin / repartidor / cliente. `verified` para repartidores |
| `orders` | Pedidos. Incluye `delivery_code`, `total_amount`, `driver_commission`, `services_count`, `payment_provider`, `payment_reference`, `paid_to_repartidor`, `platform_fee_paid` |
| `messages` | Chat por pedido |
| `schedules` | Horario por servicio (`service_slug`, `is_open`, `open_time`, `close_time`, `days_open`) |
| `settings` | Clave/valor jsonb. Ver abajo |
| `locales_comida` | [[Directorio de comida]] (migración 009) |

## Claves de `settings`
| key | valor |
|---|---|
| `business_open` | bool, toggle manual online/offline |
| `business_schedule` | `{monday:{open,close}\|null, ...}` |
| `hiring_active` | bool, muestra el toast de repartidores |
| `service_fee_online` / `service_fee_offline` | precios, ver [[Precios y comisiones]] |

## RLS
- Funciones helper: `mandados.is_admin()`, `mandados.is_verified_repartidor()`.
- `locales_comida`: lectura pública de activos; escritura solo admin.
- `settings` y `schedules`: lectura pública; escritura solo admin (010). **Ojo:** RLS no alcanza, además hacen falta GRANTs al rol (011). Si una tabla nueva da `permission denied` (42501), falta el GRANT.

- `orders` y `messages` (013): el anónimo **no** puede leer ni modificar. Puede insertar pedidos solo en estado inicial (`pendiente`, sin repartidor, sin pagos marcados) y mensajes como `cliente`. Para el seguimiento usa las funciones `get_order(p_id)`, `get_order_messages(p_id)` y `set_payment_proof(p_id, p_url)`.

## Storage
| Bucket | Sube | Lee |
|---|---|---|
| `audio-pedidos` | cualquiera | público |
| `tickets` | usuario logueado (repartidor/admin) | público |
| `comprobantes` | cualquiera (cliente en checkout) | público |

## Edge functions (`supabase/functions/`)
Todas con `verify_jwt = false`. Secret cargado: `MP_ACCESS_TOKEN` (producción). Proyecto compartido con cloudweb: los secrets también.

| Función | Qué hace | Estado |
|---|---|---|
| `create-payment` | Link MP del pedido. Cobra `total_amount` leído de la base; URLs con `SITE_URL`; `external_reference` = ID | Desplegada v4 |
| `create-platform-fee-payment` | Link MP de la comisión (item `<id>-fee`). Monto leído de `orders.platform_fee`, nunca del navegador | Desplegada v2 |
| `whatsapp-send` | Mensajes por Meta Cloud API | **No desplegada** a propósito |
| `payment-webhook` | Aviso de MP → re-consulta el pago → compara lo cobrado (ARS) con `total_amount` o `platform_fee` → actualiza `orders`. Si no alcanza, no marca nada | Desplegada v5 |

**Ojo:** el rol `service_role` necesita GRANTs explícitos sobre el schema `mandados` (015). Sin eso las funciones fallan con 42501 y el webhook nunca marcaba pagos.

## Migraciones
`supabase/migrations/001`–`019`. 018: `platform_fee_pct` configurable. 019: mínimo de `total_amount` en pedidos MP. 016/017: trigger `proteger_campos_pago` en `orders`. Quien no es admin ni webhook no puede tocar `payment_status`, `paid_at`, `payment_reference`, `total_amount`, `paid_to_repartidor` ni `platform_fee_paid`; `platform_fee` siempre se deriva de `purchase_amount` (% de `platform_fee_pct`, null si no hay compra); `purchase_amount` > 0 y congelado una vez paga la comisión. Es `security invoker` a propósito (con definer, `current_user` sería siempre `postgres`). **No aplicar 003** (borra `schedules`) **ni la parte de settings de 008** (abre la escritura). La base real no sigue los archivos uno a uno: revisar con `list_tables` antes de aplicar.
