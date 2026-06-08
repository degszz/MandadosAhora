# Setup del sistema de repartidores (Supabase + Google OAuth)

## Checklist rápido (lo que tenés que hacer)

- [ ] 1. **Exponer schema `mandados`** en Supabase Dashboard → Settings → API → Exposed Schemas
- [ ] 2. **Aplicar migración SQL** desde `supabase/migrations/001_initial_schema.sql` (vía MCP o SQL Editor)
- [ ] 3. **Crear bucket Storage** `audio-pedidos` (público) en Supabase Dashboard → Storage
- [ ] 4. **Google Cloud Console**: crear OAuth consent screen + OAuth client ID
- [ ] 5. **Supabase Auth**: pegar Client ID y Secret de Google en Providers → Google
- [ ] 6. **Supabase Auth → URL Config**: Site URL = `http://localhost:4321`, Redirect URLs con `/auth/callback`
- [ ] 7. **Probar**: `npm run dev` → entrar a `/admin` → login con Google

---

## 0. Variables de entorno

Ya están en `.env` (no se sube a git):

```
PUBLIC_SUPABASE_URL=https://aiagaddxujtbyudriulh.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_9xwthmJt-M3ly_cytUolTw_bk0hxAqe
```

Proyecto Supabase: **cloudweb** (ID `aiagaddxujtbyudriulh`, región `sa-east-1`). Las tablas viven en el schema **`mandados`** para no chocar con la otra app que cohabita en este proyecto.

---

## 1. Exponer el schema `mandados` (CRÍTICO — sin esto nada anda)

Por defecto Supabase solo expone el schema `public` vía PostgREST. Hay que agregar el nuestro.

1. Entrá al [dashboard del proyecto](https://supabase.com/dashboard/project/aiagaddxujtbyudriulh)
2. **Settings → API → Exposed schemas**
3. En el textbox agregá `mandados` (queda como `public, graphql_public, mandados`)
4. Guardá.

Si te olvidás de esto vas a ver errores tipo `404 Not Found` o `schema "mandados" does not exist` en las llamadas del cliente.

---

## 2. Configurar Google OAuth

### 2.1 Crear credenciales en Google Cloud Console

1. Entrá a https://console.cloud.google.com/
2. Creá (o usá) un proyecto. Arriba a la izquierda hay un selector.
3. En el buscador escribí **"OAuth consent screen"** y entrá.
   - User Type: **External**
   - App name: `Mandados Ahora`
   - User support email: `maxxfiguera765@gmail.com`
   - Developer contact: tu email
   - Scopes: agregá `email`, `profile`, `openid` (vienen por default)
   - Test users: agregá `maxxfiguera765@gmail.com` y los emails de los repartidores
   - Guardá.
4. En el buscador escribí **"Credentials"** → **Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Mandados Ahora — Supabase`
   - **Authorized JavaScript origins:**
     - `http://localhost:4321`
     - `https://aiagaddxujtbyudriulh.supabase.co`
     - (cuando tengas dominio propio, agregalo: `https://tudominio.com`)
   - **Authorized redirect URIs:**
     - `https://aiagaddxujtbyudriulh.supabase.co/auth/v1/callback`
   - Create
5. Copiá **Client ID** y **Client secret**.

### 2.2 Pegar las credenciales en Supabase

1. En el dashboard de Supabase → **Authentication → Providers → Google**
2. Activá el toggle "Enable Sign in with Google"
3. Pegá `Client ID` y `Client Secret`
4. En **Callback URL** ya está la URL correcta: `https://aiagaddxujtbyudriulh.supabase.co/auth/v1/callback`
5. Guardá.

### 2.3 Configurar Site URL y Redirect URLs

1. **Authentication → URL Configuration**
2. **Site URL**: `http://localhost:4321` (para dev). Después en prod cambialo a tu dominio.
3. **Redirect URLs (allow list)**: agregá todas las que vayas a usar, separadas por línea:
   ```
   http://localhost:4321/auth/callback
   http://localhost:4321/**
   https://tudominio.com/auth/callback
   https://tudominio.com/**
   ```
4. Guardá.

---

## 3. Flujo verificado

1. Repartidor entra a `/repartidor` → clickea **Iniciar sesión con Google**.
2. Google lo redirige a `https://...supabase.co/auth/v1/callback?code=...`.
3. Supabase canjea el código, crea la sesión, redirige a `http://localhost:4321/auth/callback?next=/repartidor/panel`.
4. Nuestro `auth/callback.astro` recupera la sesión y manda al destino correcto según el rol.
5. La primera vez, el trigger `mandados.handle_new_user` crea su `profile` con `role='repartidor'` y `verified=false`. Lo redirige a `/repartidor/espera`.
6. `maxxfiguera765@gmail.com` se crea automáticamente como `role='admin'` y `verified=true`.

---

## 4. Estructura de la base de datos

El schema completo está versionado en `supabase/migrations/001_initial_schema.sql`.

**Aplicar la migración**: pegá el contenido del archivo en el SQL Editor del dashboard de Supabase, o el MCP lo va a aplicar automáticamente cuando esté conectado.

Schema `mandados`:

| Tabla     | Filas iniciales | Notas                                                                                  |
|-----------|-----------------|----------------------------------------------------------------------------------------|
| profiles  | 0               | 1:1 con `auth.users`. Trigger `on_auth_user_created` la rellena al signup.             |
| orders    | 0               | `items` = JSONB con los servicios del carrito. RLS: anon puede INSERT (checkout).      |
| messages  | 0               | Chat por pedido. RLS: admin + repartidor asignado + anon (cliente).                    |
| settings  | 3               | `business_open`, `business_schedule`, `hiring_active`.                                 |
| schedules | 14              | Una fila por servicio. Horarios configurados por el admin desde el panel.              |

**Funciones**:
- `mandados.handle_new_user()` — trigger que crea profile al signup. `maxxfiguera765@gmail.com` → `role='admin'`.
- `mandados.claim_order(uuid)` — RPC para tomar pedido atómicamente (first-wins).
- `mandados.is_admin()`, `mandados.is_verified_repartidor()` — helpers para RLS.

**Storage bucket**: `audio-pedidos` (público, 5 MB, audio/*). Crear manualmente desde el dashboard o vía MCP.

**Realtime**: `mandados.orders` y `mandados.messages` en `supabase_realtime`.

---

## 5. Rutas del frontend

| Ruta                      | Quién puede entrar                     | Qué hace |
|---------------------------|----------------------------------------|----------|
| `/repartidor`             | público                                | Login con Google |
| `/repartidor/espera`      | sesión, no verified                    | "Pendiente de aprobación" + realtime para auto-redirect |
| `/repartidor/panel`       | sesión + verified + role=repartidor    | Lista de pedidos + chat realtime |
| `/auth/callback`          | redirect de Google OAuth               | Canjea código y enruta por rol |
| `/admin`                  | admin Google **o** password `MAfinomax`| Login dual + tabs: Repartidores / Pedidos Supabase / Pedidos legacy |

---

## 6. Cambios en código (resumen)

- ✅ `src/scripts/supabase.js` — cliente lazy + helpers `signInWithGoogle`, `getMyProfile`
- ✅ `src/components/RepartidorPanel.jsx` — isla Preact con lista + chat realtime
- ✅ `src/components/AdminPanel.jsx` — isla Preact admin (tabs: Repartidores / Pedidos / Horarios / Resumen)
- ✅ `src/components/CustomerTracker.jsx` — seguimiento de pedido del cliente con realtime
- ✅ `src/pages/repartidor/index.astro`, `espera.astro`, `panel.astro`
- ✅ `src/pages/auth/callback.astro`
- ✅ `src/pages/admin.astro` — login dual (Google + password). Flujo password MAfinomax intacto
- ✅ `src/pages/checkout.astro` — inserta también en `mandados.orders` (fire-and-forget, no rompe WhatsApp)
- ✅ `src/pages/index.astro` — badge online/offline consultando settings/schedules de Supabase
- ✅ `src/components/Footer.astro` — link visible "🛵 Soy repartidor"
- ✅ `supabase/migrations/001_initial_schema.sql` — DDL completo del schema `mandados`

**No tocado** (como pediste):
- `src/scripts/cart.js`
- `src/components/CartDrawer.astro`
- Formularios de servicios (`src/pages/servicios/[slug].astro`)
- Flujo WhatsApp del checkout (sigue 100% igual)
- Login con `MAfinomax`

---

## 7. Probar localmente

```bash
npm run dev
```

1. Entrá a `http://localhost:4321/repartidor` con tu Google **no admin** → vas a quedar en `/repartidor/espera`.
2. En otra pestaña, entrá a `http://localhost:4321/admin` con `maxxfiguera765@gmail.com` → tab "Repartidores" → click **✓ Verificar**.
3. La pestaña del repartidor debería auto-redirigir a `/repartidor/panel` por realtime.
4. Hacé un pedido cualquiera desde la home → checkout → "Confirmar" → mirá el panel del repartidor (debería aparecer realtime).
5. Tomá el pedido, abrí el chat, mandate un mensaje desde la otra pestaña (admin) y verificá que llegue instantáneo.
