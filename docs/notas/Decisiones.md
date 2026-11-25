# Decisiones

Volver: [[00 Inicio]]

Registro corto: qué se decidió y por qué. Lo más nuevo arriba.

- **2026-11-25 — Precios en `settings`, cálculo en la base.** El admin edita envío y % de comisión. El frontend los muestra con `pricing.js`, pero los montos que se cobran salen siempre de la base (trigger y edge functions), nunca del navegador.
- **2026-11-24 — Clientes sin lectura de tablas.** El anónimo crea pedidos (el ID se genera en el navegador con `crypto.randomUUID()`, porque no puede leer la fila de vuelta) y consulta uno solo por ID exacto con funciones `security definer`. `/pedido` consulta cada 6 s en vez de Realtime, porque Realtime necesita lectura abierta. Antes cualquiera podía listar y modificar todos los pedidos.
- **2026-11-24 — Solo MercadoPago.** Stripe no opera en Argentina; MP ya cobra con tarjeta. `whatsapp-send` no se despliega hasta tener la API de Meta: sería un endpoint abierto que manda mensajes.
- **2026-11-21 — Pedido rápido con asistente de 3 pasos.** Guarda en el panel y recién después ofrece WhatsApp con un botón, porque los celulares bloquean abrirlo solo. Ver [[Pedido rápido]].
- **2026-11-11 — Estado online/offline compartido.** `src/scripts/business.js` es la única lógica; carrito, checkout, modal y página de servicio la usan. Antes cada lugar tenía su regla y no coincidían.
- **2026-11-11 — Bug de horarios era de permisos.** `settings` y `schedules` tenían policies pero no GRANT; todo fallaba en silencio. Migración 011.

- **2026-11-10 — Directorio de comida sin intermediar pedidos.** En Monte no se usan Rappi ni PedidosYa y cada emprendimiento tiene su WhatsApp/IG. Mostrar contactos es barato de mantener y no compite con los locales. Primera versión: solo contacto + categoría + horario, sin fotos de platos (se pueden sumar después). Ver [[Directorio de comida]].
- **2026-11-10 — Bóveda Obsidian en `docs/`.** Notas cortas por tema para que cada sesión lea una nota en vez de explorar el código.
- **Mapas con Leaflet/OSM**, no Google Maps: sin API key ni costo.
- **GPS solo en celular**: en escritorio la ubicación del navegador es imprecisa; ahí solo dirección escrita.
- **Estado online/offline global** con toggle manual + horario semanal. El servicio 24hs queda siempre disponible con tarifa nocturna.
- **Repartidor confirma con código de 6 dígitos** que tiene el cliente: evita marcar entregas que no pasaron.
- **Schema `mandados`** separado porque el proyecto Supabase es compartido con otra app.
