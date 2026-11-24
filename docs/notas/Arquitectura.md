# Arquitectura

Volver: [[00 Inicio]]

## Stack
- Astro 5 estático + islas Preact (`client:load` / `client:only="preact"`).
- Tailwind v4 vía `@tailwindcss/vite`; config en `src/styles/global.css`. `tailwind.config.js` es vestigial.
- Supabase (auth Google, Postgres, storage, edge functions). Ver [[Supabase]].
- Mapas: **Leaflet + OpenStreetMap** en `src/scripts/gmaps.js` (el nombre del archivo es histórico; no usa Google Maps).

## Páginas (`src/pages/`)
| Ruta | Qué hace |
|---|---|
| `/` `index.astro` | Hero con círculo de servicios que ciclan sin repetirse, badge online/offline, banner 24hs, acceso a [[Directorio de comida]], grid de servicios |
| `/servicios/[slug]` | Formulario por servicio. Ubicación GPS solo en celular (4 estados: empty/loading/result/error) |
| `/checkout` | Pago (MercadoPago / efectivo), código de entrega, mensaje WhatsApp. Ver [[Pedidos y entrega]] |
| `/comida` | Directorio de locales de comida |
| `/pedido` | Seguimiento del cliente |
| `/pago-exitoso` | Vuelta de Stripe/MP |
| `/admin` | Panel admin, solo con Google y rol admin |
| `/repartidor`, `/repartidor/espera`, `/repartidor/panel` | Ver [[Repartidores]] |
| `/auth/callback` | Canje PKCE de Google OAuth |

## Componentes clave
- `Layout.astro`: header, scrollbar custom flotante, barra de progreso, toast "buscamos repartidores", CartDrawer, ServiceModal. Lee env de Supabase vía `<meta name="sb-url|sb-key">`.
- `Header.astro`: transparente arriba, vidrio blanco al scrollear. El hero de la home usa `-mt-[75px]` para que el degradado quede detrás del header.
- `AdminPanel.jsx`: tabs Repartidores, Pedidos, Horarios, Resumen, Pagos, Comida + `BusinessStatusControl` arriba.
- `LocalesAdmin.jsx`: tab Comida.
- `RepartidorPanel.jsx`: lista de pedidos para repartidor y admin (`mode="admin"`).
- `CartDrawer.astro`: drawer del carrito.

## Datos estáticos
- `src/data/servicios.js`: array `SERVICIOS` (fuente única de los rubros). Imagen en `public/<nombre>.avif`.

## Reglas que no hay que romper
- **Carrito con dos eventos**: `cart:change` re-renderiza, `cart:update` no (preserva el foco del textarea). No unificar.
- **Estilos inline** en HTML generado por JS: Tailwind purga clases que no aparecen en el source.
- Número WhatsApp `5492271415182`: en `src/scripts/whatsapp.js` para mensajes de pedido; también repetido en `cart.js`, `AudioRecorder.jsx`, `comida.astro`, `RepartidorPanel.jsx`, `Menu.astro`, `index.astro`.
- Estado online/offline: `src/scripts/business.js`. Ver [[Horarios y estado online]].
