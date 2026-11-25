# Precios y comisiones

Volver: [[00 Inicio]] · Relacionado: [[Horarios y estado online]], [[Pedidos y entrega]]

## Se editan desde el admin → 💲 Precios
| Concepto | `settings.key` | Valor inicial | Quién lo recibe |
|---|---|---|---|
| Costo de envío por servicio | `service_fee_online` | $2.500 | Repartidor |
| Costo de envío 24hs fuera de horario | `service_fee_offline` | $3.500 | Repartidor |
| Comisión de plataforma | `platform_fee_pct` | 15% (0–50) | Mandados Ahora |

Los cambios se aplican a pedidos nuevos; los viejos conservan su precio.

## Dónde se usan
- Frontend: `src/scripts/pricing.js` → `getPricing()` (sincrónico, cache en `localStorage` `mandados_pricing_v1`) y `loadPricing()` (lee Supabase y emite `pricing:change`). Lo usan carrito, checkout, pedido rápido, panel del repartidor, `/repartidor` y el cartel 24hs de la home.
- Base (lo que vale de verdad):
  - `platform_fee` lo calcula el trigger `proteger_campos_pago` con `mandados.platform_fee_pct()` sobre `purchase_amount` (migraciones 016–018). Lo que muestra el panel es informativo.
  - Al crear un pedido con MercadoPago, `total_amount` tiene que ser ≥ servicios × el costo de envío más bajo (`mandados.min_order_total`, migración 019).
- Edge functions: `create-payment` cobra `total_amount` del pedido y `create-platform-fee-payment` cobra `platform_fee`. Ninguna acepta montos del navegador.

## Flujo de la comisión
Se calcula **después de la entrega**, sobre el ticket que sube el repartidor, y se cobra con el link de `create-platform-fee-payment`. "Fuera de horario" = negocio offline, según `isOfflineNow()` de `src/scripts/business.js`. Ver [[Horarios y estado online]].

## Historia
Antes: $3.000 por servicio + 15% para el repartidor; después $3.000 / $2.000 al repartidor; luego $2.500 / $3.500 fijos en el código. Desde 2026-11-25, editables. Ver [[Decisiones]].
