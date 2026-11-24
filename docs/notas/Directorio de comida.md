# Directorio de comida ("¿Qué comemos?")

Volver: [[00 Inicio]]

## Qué es
Página `/comida` con los emprendimientos de comida de Monte. Muestra cada local con botones a su WhatsApp, Instagram y web. **Mandados Ahora no toma ni cobra esos pedidos**: el cliente le pide directo al local. Es un favor al pueblo y una puerta de entrada al sitio.

Si un local no tiene delivery propio, la card ofrece "te lo llevamos nosotros" (WhatsApp de Mandados Ahora).

## Piezas
| Archivo | Rol |
|---|---|
| `supabase/migrations/009_locales_comida.sql` | Tabla `mandados.locales_comida` + RLS (lectura pública de activos, escritura admin) |
| `src/scripts/locales.js` | `CATEGORIAS`, `isOpenNow`, `horarioHoy`, `waLink`, `igLink`, `safeUrl`, `fetchLocales` |
| `src/pages/comida.astro` | Página pública: buscador, chips por categoría, "solo abiertos ahora", abiertos primero |
| `src/components/LocalesAdmin.jsx` | Tab "🍔 Comida" del admin: alta/edición, ocultar, borrar |
| `index.astro` / `Header.astro` | Accesos a `/comida` |

## Reglas
- `horario` usa el mismo formato que `business_schedule`. Soporta cierres después de medianoche (20:00 → 00:30).
- Sin horario cargado → la card no muestra abierto/cerrado y no aparece con el filtro "solo abiertos".
- WhatsApp se normaliza a `549` + número.
- URLs de web y logo: solo `http(s)` (`safeUrl`). Todo texto se escapa antes de ir al HTML.

## Ideas para después
Fotos de platos o menú, destacados pagos, contador de clics por local para mostrarle al emprendedor cuánta gente le llegó.
