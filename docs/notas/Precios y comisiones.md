# Precios y comisiones

Volver: [[00 Inicio]] · Relacionado: [[Horarios y estado online]], [[Pedidos y entrega]]

## Modelo actual (en `checkout.astro` y `CartDrawer.astro`)
| Concepto | Valor | Quién lo recibe |
|---|---|---|
| Service fee normal (`SERVICE_FEE_ONLINE`) | $2.500 por servicio | Repartidor |
| Service fee 24hs fuera de horario (`SERVICE_FEE_OFFLINE`) | $3.500 | Repartidor |
| Fee de plataforma (`PLATFORM_FEE_PERCENT`) | 15% del ticket real | Mandados Ahora |

- El 15% se calcula **después de la entrega**, sobre el ticket que sube el repartidor, y se cobra con `create-platform-fee-payment`.
- "Fuera de horario" = negocio offline, según `isOfflineNow()` de `src/scripts/business.js`. Ver [[Horarios y estado online]].
- Los valores también existen en `settings` (`service_fee_online`, `service_fee_offline`).

## Historia
Antes: $3.000 por servicio + 15% para el repartidor; después $3.000 / $2.000 al repartidor. Ver [[Decisiones]].

## Cuidado
La página `/repartidor` muestra textos de ganancia. Si cambian los precios, actualizar también ahí.
