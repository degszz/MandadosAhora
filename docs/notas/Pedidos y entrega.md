# Pedidos y entrega

Volver: [[00 Inicio]]

## Flujo
1. Cliente arma carrito desde `/servicios/[slug]` (dirección por GPS en celular o escrita).
2. `/checkout`: elige pago (MercadoPago o efectivo). Se genera un **código de entrega de 6 dígitos**.
3. Se guarda en `orders` y se arma un mensaje de WhatsApp sin emojis.
4. Repartidor toma el pedido en `/repartidor/panel`, navega con Google Maps (`maps/dir/?...&travelmode=driving`).
5. Para confirmar la entrega tiene que ingresar el código que le da el cliente.
6. Sube foto del ticket → se calcula el 15% de plataforma. Ver [[Precios y comisiones]].

## Camino corto
Ver [[Pedido rápido]]: crea la misma orden con `createOrder()` sin pasar por el carrito.

## Seguimiento
`/pedido?id=...` (`CustomerTracker.jsx`). El cliente guarda sus IDs en `localStorage` (`mandados_my_orders`). Consulta con `get_order` / `get_order_messages` cada 6 s (no Realtime: el anónimo no tiene lectura de tablas, ver [[Supabase]]).

## localStorage del cliente
| Key | Módulo |
|---|---|
| `mandados_cart_v1` | `cart.js` |
| `mandados_orders_v1` | `orders.js` (legacy) |
| `mandados_profile_v1` | `profile.js` |

Relacionado: [[Repartidores]], [[Supabase]]
