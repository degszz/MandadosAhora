# Pedido rápido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Ejecución nativa en la misma sesión, pedida por el usuario.

**Goal:** caja "¿Qué necesitás?" en la home que crea un pedido en 3 pasos y lo manda por WhatsApp.

**Architecture:** componente Astro con script cliente; reusa `createOrder`, `geolocate`, `business.js` y un mensaje de WhatsApp compartido con el checkout.

**Tech Stack:** Astro 5, Supabase. Sin tests: verificar con `npm run build` y navegador.

**Spec:** `docs/notas/Pedido rápido.md`

## Global Constraints
- Item: `{ servicio: "Pedido rápido", descripcion }`; fuera de horario `servicio: "24 Horas"`.
- Tarifa $2.500; fuera de horario $3.500. Comisión igual a la tarifa.
- Pago: `efectivo` o `mercadopago`. Sin Stripe.
- WhatsApp y MercadoPago se abren con un toque del usuario.

## Review Focus
- Doble toque en Confirmar: un solo pedido.
- Falla al guardar: no se pierde lo escrito y se puede reintentar.
- MercadoPago sin credenciales: el pedido queda guardado y se ofrece WhatsApp.
- GPS denegado: se puede escribir la dirección.
- Texto con HTML: se muestra como texto.

---

### Task 1: Mensaje compartido
**Files:** Create `src/scripts/whatsapp.js`; Modify `src/pages/checkout.astro`
**Produces:** `buildOrderMessage({ orderId, nombre, telefono, servicios, direccion, total, metodo, paymentUrl, deliveryCode }) -> string`, `whatsappOrderUrl(sameArgs) -> string`
- [ ] Mover el formato del mensaje y hacer que el checkout lo use.
- [ ] `npm run build` termina sin errores.

### Task 2: Componente y hero
**Files:** Create `src/components/PedidoRapido.astro`; Modify `src/pages/index.astro`
**Consumes:** Task 1, `createOrder`, `createMPPreference`, `geolocate`, `reverseGeocode`, `fetchBusinessStatus`, `isOfflineNow`, `getProfile`, `setProfile`
- [ ] Caja + ventana de 3 pasos + pantalla final.
- [ ] Probar en navegador los puntos de Review Focus y un pedido real de prueba, que después se borra.
- [ ] Actualizar notas de la bóveda.
