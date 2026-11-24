# Pedido rápido

Volver: [[00 Inicio]] · Relacionado: [[Pedidos y entrega]], [[Precios y comisiones]], [[Horarios y estado online]]

Estado: **implementado** (2026-11-21). Código: `src/components/PedidoRapido.astro`, `src/scripts/whatsapp.js`.

## Por qué
Hoy pedir lleva 4 pantallas (rubro → formulario → carrito → checkout con 3 pagos y otra vez la dirección). La gente se marea. Lo que quiere decir entra en una frase: "2 cocas y pan lactal del súper".

## Objetivo
Una caja "¿Qué necesitás?" arriba de la home. Escribís, y en **3 pasos cortos** el pedido queda en el panel (como cualquier otro) y te llega por WhatsApp.

**No-objetivos:** reemplazar rubros/carrito/checkout (siguen para quien los quiera); IA en WhatsApp (proyecto aparte, después).
**Anti-objetivo:** que el pedido rápido llegue por WhatsApp pero no al panel, o al revés.

## Enfoques considerados
- **A. Asistente de 3 pasos en la home** ← elegido. Resuelve el mareo y reusa lo existente.
- B. La caja carga el carrito y manda al checkout actual: el checkout sigue con todas las opciones.
- C. Pantalla tipo chat: más trabajo y se pisa con la futura IA de WhatsApp.

## Cómo funciona (decidido)
1. **Caja en el hero**: textarea "¿Qué necesitás? Ej: 2 cocas y pan lactal del súper" + botón "Pedir". Abre una ventana (bottom sheet en celular, modal en escritorio) con el texto ya cargado y editable.
2. **Paso 1 — ¿Dónde te lo llevamos?** GPS (solo celular) o dirección escrita. Autocompleta desde el perfil guardado.
3. **Paso 2 — Tus datos y pago**: nombre, teléfono (opcional) y pago con dos opciones grandes: *Efectivo al recibir* / *MercadoPago*.
4. **Paso 3 — Confirmar**: resumen (qué, dónde, cuánto) → "Confirmar pedido".
5. Al confirmar: se crea la orden con `createOrder()` de `orders.js` (aparece en el panel, con código de entrega) y se muestra la pantalla final con:
   - código de entrega bien grande,
   - botón **"Enviar por WhatsApp"** (mensaje con el pedido, la dirección y el código),
   - si eligió MercadoPago: botón **"Pagar con MercadoPago"**.
   Los botones los toca el usuario: los celulares bloquean `window.open` que no viene de un toque.

## Reglas
- Item guardado: `{ servicio: "Pedido rápido", descripcion: <texto> }`, 1 servicio.
- Precio: tarifa de servicio estándar ($2.500, o $3.500 fuera de horario según `isOfflineNow()`). Más el 15% sobre el ticket después de la entrega, como siempre.
- **Fuera de horario**: el pedido rápido se marca como 24 Horas y se avisa del precio nocturno antes de confirmar.
- Mínimo 3 caracteres en "qué necesitás"; dirección obligatoria; nombre obligatorio.
- Stripe no se ofrece (no opera en Argentina).

## Piezas (para el plan)
- `src/scripts/whatsapp.js` (nuevo): `buildOrderMessage()` compartido, sale de `checkout.astro`.
- `src/components/PedidoRapido.astro` (nuevo): caja + ventana de 3 pasos + script.
- `index.astro`: montar la caja en el hero.
- `checkout.astro`: usar `buildOrderMessage()` compartido.

## Lo que queda al criterio de quien lo construya
Textos exactos, animaciones, y si la caja reemplaza o acompaña los botones "Empezar pedido / WhatsApp" del hero (sugerencia: la caja va arriba y los botones quedan debajo, más chicos).
