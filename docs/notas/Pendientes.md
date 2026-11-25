# Pendientes

Volver: [[00 Inicio]]

## Antes de dar por terminado
- [ ] Commit de todos los cambios y redeploy en Netlify.
- [ ] Probar en celular real: GPS, WhatsApp, pedido, pago con MP, repartidor, código de entrega, `/pedido`.
- [ ] Cargar locales de comida, con permiso de cada uno.

## Técnico
- [ ] Probar con un repartidor real que al subir el ticket se guarde bien la comisión (trigger 016) y que NO pueda marcarla como paga.
- [ ] Bucket `comprobantes`: cualquiera puede subir (limitado a imágenes/PDF de 8 MB). Mejorar con URLs firmadas emitidas por una función.
- [ ] El modal de servicios bloquea solo por offline; el horario propio de cada servicio lo aplica `/servicios/[slug]`.
- [ ] Borrar el archivo de prueba `comprobantes/prueba-borrar.png` del bucket `comprobantes` (desde el dashboard; SQL no deja).
- [ ] Opcional: validar la firma secreta de MP en `payment-webhook` (`MP_WEBHOOK_SECRET`). Hoy se re-consulta el pago a la API, que ya evita pagos inventados.

## Manual del dueño
- [ ] Decidir plan de Supabase: el gratis se pausa por inactividad y deja el sitio sin datos. Se comparte con cloudweb.

## Después
- [ ] IA en WhatsApp con derivación a humano (proyecto aparte; requiere API oficial de Meta). Incluye desplegar `whatsapp-send`, que el checkout ya llama (hoy falla en silencio).

## Hecho
- [x] 2026-11-24 MercadoPago: app Checkout Pro, `MP_ACCESS_TOKEN` de producción, webhook (evento Pagos).
- [x] 2026-11-24 Supabase Auth: Site URL y Redirect `https://mandadosahora.netlify.app/auth/callback`.
- [x] 2026-11-24 Migración 013: anon ya no lista ni modifica pedidos/mensajes. Seguimiento por funciones `get_order`, `get_order_messages`, `set_payment_proof`.
- [x] 2026-11-24 Migración 014: buckets `tickets` (sube usuario logueado) y `comprobantes` (sube cualquiera), públicos para leer.
- [x] 2026-11-24 `payment-webhook` v5 (solo MP, clave de servicio, distingue comisión `-fee`, verifica monto cobrado) y `create-platform-fee-payment` v2 (monto desde la base) desplegadas.
- [x] 2026-11-25 Precios editables desde admin → 💲 Precios (envío normal, envío 24hs y % de comisión). Migración 018 + `src/scripts/pricing.js`.
- [x] 2026-11-25 `create-payment` v4: solo MP, cobra `total_amount` del pedido, URLs desde `SITE_URL`. Migración 019: mínimo de total para pedidos MP.
- [x] 2026-11-24 Migración 016: trigger `proteger_campos_pago` (solo admin/webhook tocan campos de pago; comisión = 15% de `purchase_amount` calculada en la base) y `set_payment_proof` restringida.
- [x] 2026-11-24 Migración 015: GRANTs a `service_role` sobre `mandados`. El webhook nunca había podido marcar un pago.
- [x] 2026-11-24 Stripe fuera del checkout. Panel legacy y contraseña del admin eliminados.
- [x] 2026-11-21 Pedido rápido. Migración 012: faltaba `customer_phone` y no se guardaba ningún pedido.
- [x] 2026-11-11 Supabase reactivado; migraciones 009, 010 y 011.
- [x] 2026-11-11 Números de WhatsApp con `549`.
- [x] 2026-11-11 `/servicios/[slug]` bloquea servicios cerrados.
- [x] 2026-11-11 Carrito/checkout usan el estado real del negocio.
- [x] 2026-11-10 `CLAUDE.md` apunta a esta bóveda.
