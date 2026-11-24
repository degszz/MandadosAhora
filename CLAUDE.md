# CLAUDE.md

Mandados Ahora: servicio de mandados/delivery en San Miguel del Monte. Astro 5 + Preact + Tailwind 4, backend Supabase (schema `mandados`). UI y código en español.

## Documentación: bóveda Obsidian en `docs/`

Empezá por `docs/00 Inicio.md` (mapa de notas). **Leé solo la nota del tema de la tarea antes de abrir código**; no recorras el repo para reconstruir lo que ya está escrito ahí. Si tu cambio vuelve falsa una nota, actualizala en el mismo cambio. Decisiones nuevas → `docs/notas/Decisiones.md`. Cosas que quedan sin hacer → `docs/notas/Pendientes.md`.

## Comandos

```bash
npm run dev     # localhost:4321
npm run build   # verificar antes de dar algo por terminado (no hay tests ni linter)
```

## Reglas que no se rompen

- **Carrito con dos eventos** (`cart.js`): `cart:change` re-renderiza el drawer, `cart:update` no (preserva el foco del textarea). No unificar.
- **Estilos inline** en HTML generado por JS (CartDrawer, checkout, admin, comida): Tailwind purga clases que no están en el source.
- Escapar todo texto de la base antes de meterlo en `innerHTML`; URLs cargadas a mano solo `http(s)`.
- Rubros de servicios: solo en `src/data/servicios.js` + imagen `.avif` en `public/`.
- Mapas: Leaflet/OSM (`src/scripts/gmaps.js`, nombre histórico).
- Proyecto Supabase compartido: nada fuera del schema `mandados`. Plan gratis, se pausa solo.
- No hacer `git push` salvo que se pida.
