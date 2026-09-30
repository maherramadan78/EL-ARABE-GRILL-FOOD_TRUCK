# El Arabe Grill POS

App tipo punto de venta para un food truck de comida arabe. Incluye POS, menu digital con carrito para WhatsApp, administracion de platillos con fotos, inventario de ingredientes, gastos, ingresos, reportes, cierre de caja y usuarios con permisos.

## Como abrir

Abre `index.html` en el navegador.

PIN inicial:

- Administrador: `1234`
- Caja: `1111`

## Flujo recomendado

1. Entra como administrador.
2. Abre `Ajustes` y verifica tu numero de WhatsApp con lada pais: `5218341422227`.
3. Revisa `Ajustes > Firebase`.
4. En `Platillos`, modifica precios, agrega platillos nuevos y pega/sube fotos.
5. En `Caja`, abre caja con el efectivo inicial.
6. En `Punto de venta`, registra ventas de mostrador.
7. Comparte `https://elarabegrill.web.app/menu` para usar el menu digital con carrito y envio por WhatsApp.
8. Revisa `Reportes` para cortes diario, semanal o mensual.
9. En `Caja`, cierra el dia y compara efectivo esperado contra efectivo contado.

## Pedidos simultaneos y mesas

- En `Punto de venta`, usa `Otro pedido` para abrir otro carrito y cambia entre las pestañas `Pedido 1`, `Pedido 2`, etc. Cada borrador conserva sus productos y datos aunque cambies de pedido o recargues el mismo navegador.
- Para comer en el local, selecciona `Comer aqui` y asigna `Mesa 1` o `Mesa 2` antes de cobrar. La mesa queda guardada en el pedido.
- Los borradores abiertos se guardan solo en ese navegador/equipo; los pedidos cobrados se sincronizan con Firebase.
- En `Pedidos`, `Actualizar desde la nube` vuelve a cargar el historial compartido. La lista muestra todos los dias y empieza por las ventas mas recientes.
- Las categorias se guardan dentro de cada platillo. En `Platillos`, usa `Actualizar catalogo` para traer platos y categorias desde Firebase. Si un plato solo aparece en el telefono y la nube no conecta, abre `Ajustes > Firebase` en ese telefono y pulsa `Subir datos actuales`; luego actualiza el catalogo en el escritorio.

## Alertas de pedidos

Para recibir aviso cuando llega un pedido del menu digital:

1. Abre el POS en `https://elarabegrill.web.app`.
2. Entra con el PIN administrador.
3. Presiona `Activar alertas`.
4. Deja el POS abierto.

La app muestra aviso, sonido y notificacion del navegador cuando entra un pedido nuevo por WhatsApp. Si el POS esta cerrado, el pedido se guarda en Firebase, pero no puede sonar en ese equipo.

## Firebase

La app ya quedo apuntando al proyecto Firebase nuevo:

- Display name: `food truck pos`
- Project ID: `food-truck-pos-55717`
- Firestore database: `(default)`

Pasos:

1. Abre el POS con internet disponible.
2. Entra con el PIN administrador `1234`.
3. Ve a `Ajustes > Firebase`.
4. Revisa que aparezca el Project ID `food-truck-pos-55717`.
5. Presiona `Subir datos actuales` para mandar tus datos locales a Firestore.

Para que el navegador pueda leer/escribir desde esta app estatica, despliega las reglas locales:

```powershell
firebase.cmd deploy --only firestore:rules,storage --project food-truck-pos-55717
```

Las reglas incluidas permiten acceso publico solo a:

- Firestore: `foodtruck_pos`
- Storage: `foodtruck-dish-photos`

## Notas importantes

- Si Firebase no carga o las reglas bloquean, la app guarda datos en `localStorage` del navegador.
- Si Firebase esta conectado, la app sincroniza el estado del POS en Firestore: `foodtruck_pos/state`.
- Los pedidos de clientes se envian por WhatsApp al numero configurado.
- Los PIN y roles de esta version son control de interfaz local, no seguridad bancaria. Antes de publicar el administrador en internet, conviene migrar a Firebase Auth y reglas por usuario.
