# Horarios y estado online

Volver: [[00 Inicio]]

## Regla
Online = `settings.business_open === true` **y** la hora actual cae dentro de `business_schedule` del día. Si el día es `null` → offline.

## Dónde se controla
`AdminPanel.jsx` → `BusinessStatusControl` (arriba de los tabs): toggle Online/Offline + desplegable "Horarios semanales".

## Qué cambia en la home (`index.astro`, script con `define:vars`)
- Badge del hero: verde "Online" / rojo "Offline".
- Offline → banner grande "Estamos fuera de horario… 24 Horas sigue disponible" arriba de servicios.
- Offline → todas las cards con overlay "Cerrado" excepto `24horas`, que muestra "Disponible · $3.500".
- Online → además respeta el horario individual de cada servicio (tabla `schedules`, tab Horarios del admin).
- Refresca cada 2 minutos.

## Módulo compartido
`src/scripts/business.js`:
- `fetchBusinessStatus()` → `{ online, schedules, ok }` y guarda el estado en `localStorage` (`mandados_business_status_v1`).
- `isOfflineNow()` sincrónico para carrito/checkout/modal: usa el estado guardado si tiene menos de 10 min; si no, regla fija (antes de 8, desde las 21, domingo).
- `isServiceScheduleOpen(sched)` para el horario propio de un servicio.
- La home (script inline con `define:vars`) no importa el módulo pero escribe la misma clave de cache.

## Bloqueo de servicios cerrados
- `/servicios/[slug]`: si offline o fuera del horario del servicio → aviso "cerrado", formulario deshabilitado, botón a 24hs.
- `ServiceModal` (círculo del hero): si offline redirige a la página del servicio.

## Detalle
La hora es la del navegador del visitante (Argentina en la práctica).

Relacionado: [[Precios y comisiones]], [[Supabase]]
