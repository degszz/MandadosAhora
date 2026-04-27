# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Mandados Ahora

Sitio estático (Astro 5 + Preact + Tailwind 4) para un servicio local de mandados/delivery en **San Miguel del Monte**. UI en español. No hay backend propio: todo el estado del cliente (carrito, pedidos, perfil, sesión admin) vive en `localStorage` del navegador.

## Commands

```bash
npm run dev       # Dev server en localhost:4321
npm run build     # Build a ./dist
npm run preview   # Preview del build
npm run astro -- --help   # CLI de Astro
```

No hay tests, linter ni typecheck configurados (solo `astro/tsconfigs/strict` para el servidor de tipos del editor).

## Stack y configuración

- **Astro 5** con `output` por defecto (estático). Integración `@astrojs/preact` para islas interactivas.
- **Tailwind v4** vía plugin de Vite (`@tailwindcss/vite`) — *no* via `@astrojs/tailwind`. La config de Tailwind se hace por CSS en `src/styles/global.css` con `@import "tailwindcss"` y `@plugin "@midudev/tailwind-animations"`. El archivo `tailwind.config.js` en la raíz está vacío y es vestigial.
- Fuentes: Poppins (h1-h3) e Inter (resto), cargadas desde Google Fonts en `src/layouts/Layout.astro`.
- Paleta principal: azul `#377DEC` (acento), `#67a7f3` (botones), gradiente de fondo gris en `Layout.astro`.

## Arquitectura

### Routing y datos de servicios

Las páginas de cada servicio (mercado, farmacia, carnicería, etc.) **no son estáticas**. Se generan desde una sola ruta dinámica:

- `src/data/servicios.js` — fuente única de verdad: array `SERVICIOS` con `{ servicio, slug, imagen, alt, gradient, titulo? }`.
- `src/pages/servicios/[slug].astro` — usa `getStaticPaths()` sobre `SERVICIOS` para generar `/servicios/<slug>/` en build.
- `src/components/ServiceCard.astro` — la card del grid en `index.astro` linkea a `/servicios/${slug}/`.

**Importante:** los antiguos archivos `src/pages/servicios/<slug>.astro` (uno por servicio) fueron eliminados y reemplazados por la ruta dinámica. Para agregar/quitar servicios, editar `src/data/servicios.js` y agregar la imagen correspondiente en `public/`.

### Estado en el cliente (localStorage)

Toda la persistencia es client-side. Cuatro "stores" independientes con su propio módulo:

| Store | Key | Módulo |
|---|---|---|
| Carrito | `mandados_cart_v1` | `src/scripts/cart.js` |
| Pedidos (admin) | `mandados_orders_v1` | `src/scripts/orders.js` |
| Perfil del cliente (autocompletar) | `mandados_profile_v1` | `src/scripts/profile.js` |
| Sesión admin | `mandados_admin_session_v1` | inline en `admin.astro` (sessionStorage) |

Cada módulo expone una API tipo CRUD + `subscribe()`. Mantener esa firma si se migra a backend (los comentarios en `orders.js` y `mercadopago.js` describen el plan).

### Eventos del carrito — sutileza importante

`cart.js` dispara **dos** eventos distintos para evitar perder el foco al editar inputs in-place en el `CartDrawer`:

- `cart:change` — cuando cambia el set de items (add/remove/clear). Causa re-render del drawer.
- `cart:update` — cuando solo se edita un campo de un item existente (descripción, negocio). El drawer **no** re-renderiza.

`updateItem()` dispara `cart:update` (silent), `addItem`/`removeItem`/`clear` disparan `cart:change`. `CartDrawer` además guarda `lastRenderedIds` y solo re-renderiza si cambió la lista de IDs — esto preserva el foco/valor del `<textarea>` mientras el usuario tipea. **No "simplificar" eso a un solo evento sin entender este motivo.**

`cart.js` también expone `window.MandadosCart` global (útil para debug en consola).

### Páginas principales

- `src/pages/index.astro` — landing. Hero, grid de servicios (`SERVICIOS.map(...)` → `ServiceCard`), carousel, secciones informativas. Anima entradas con `IntersectionObserver` sobre `[data-reveal]`.
- `src/pages/servicios/[slug].astro` — formulario por servicio (nombre, negocio, descripción, dirección manual o por mapa). Hace `addItem()` al carrito y `setProfile()` para autocompletar la próxima vez. La pestaña "mapa" carga Google Maps **lazy** (solo al abrirse).
- `src/pages/checkout.astro` — checkout completo con elección de pago (efectivo / transferencia con MercadoPago stub). Crea un `Order` vía `orders.js` y construye un mensaje WhatsApp.
- `src/pages/admin.astro` — panel del dueño. Login con contraseña hardcodeada (ver más abajo), lista pedidos desde `orders.js`, permite marcar pagado/completado/cancelado. **Importante**: como `orders.js` usa `localStorage`, el admin **solo ve los pedidos creados en su propio navegador**. Esto es aceptable hoy porque el flujo real es por WhatsApp; el panel es preparatorio para cuando exista backend.

### Componentes

- `Layout.astro` envuelve todas las páginas con Header + main + Footer + CartDrawer (drawer global accesible desde cualquier página).
- `CartDrawer.astro` — drawer flotante (botón fijo bottom-right). Renderiza items con HTML inline, sus inputs llaman a `updateItem()` con el evento silent.
- `AudioRecorder.jsx` — única isla **Preact** real. Se monta con `client:load` en `index.astro`. Permite grabar audio y enviarlo por WhatsApp.

### Integraciones externas

- **WhatsApp**: número `2271415182` está hardcodeado en `src/scripts/cart.js` (`WA_NUMBER`), `src/components/AudioRecorder.jsx` y `src/pages/checkout.astro`. Si se cambia, actualizar los tres.
- **Google Maps**: API key en `src/scripts/gmaps.js` como `GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY"` (placeholder). La función `isGmapsConfigured()` chequea ese sentinel; mientras no se reemplace, los formularios siguen funcionando con la opción "Escribir" pero el tab "mapa" muestra un fallback. Coordenadas iniciales del mapa centran en San Miguel del Monte (`-35.4378, -58.8094`).
- **MercadoPago**: `src/scripts/mercadopago.js` es un **stub** en modo demo (genera un link y QR ficticios con `api.qrserver.com`). Para producción se debe setear `MP_BACKEND_URL` apuntando a un endpoint propio que use el SDK con el access token (no se puede hacer desde el navegador).

### Contraseña admin

`ADMIN_PASSWORD` está hardcodeada en `src/pages/admin.astro` (`"MAfinomax"`). Es un sitio estático sin backend, así que cualquier protección real depende de mover esto a un servicio autenticado. No tratar como secreto serio.

## Convenciones

- UI y nombres de variables/comentarios mayormente en español. Mantener ese estilo al editar.
- Estilos inline (`style="..."`) se usan en partes críticas del DOM generado por JS (CartDrawer, checkout, admin) porque Tailwind purga clases que no aparecen en el source — al inyectar HTML como string, las clases pueden no estar incluidas. **No reemplazar inline styles por clases Tailwind sin verificar que las clases queden en el bundle final.**
- Imágenes en `.avif` en `public/` con nombres semánticos (`shop.avif`, `farmacia.avif`, etc.). El campo `imagen` de `SERVICIOS` debe matchear con un archivo en `public/`.
