# Implementación local de SQL Connect

La fase C implementa el esquema relacional y el flujo de compra de prueba en el proyecto de emulación `demo-nexatech`. El destino de base en el esquema se llama `fdcdb` y el emulador lo crea en PGlite. Las operaciones de cuenta se prueban con usuarios sintéticos del emulador de Authentication.

## Esquema, migraciones y SDK

| Archivo | Contenido |
| --- | --- |
| [schema.gql](../dataconnect/schema/schema.gql) | Línea base versionada de 40 tablas. SQL Connect genera el DDL inicial. |
| [staff.gql](../dataconnect/schema/staff.gql) | Vistas de lectura para personal. Cruzan el UID del lector con el rol vigente y, en soporte, la asignación del caso. |
| [migrations](../dataconnect/migrations) | Cinco migraciones complementarias. Aplican restricciones, índices parciales, FK restrictivas, disparadores de auditoría y las reglas transaccionales de compra y posventa. |
| [demo.sql](../dataconnect/seed/demo.sql) | Semilla repetible de 18 productos en seis categorías. Computadoras, Audio y Smartphones presentan cinco fichas cada una. Incluye existencias con movimientos de apertura, tarifas, cupón y documentos académicos. |
| [Conectores](../dataconnect/dataconnect.yaml) | `storefront`, `account` y `staff`, con SDK JavaScript y declaraciones TypeScript en `src/dataconnect-generated/`. Se usa el SDK web directo para la validación y la futura integración React. |
| [Entorno local](../firebase.local.json) | Auth en `127.0.0.1:9099`, SQL Connect en `127.0.0.1:9399` y PGlite en `127.0.0.1:9543`. |

Los archivos GraphQL definen la versión del DDL que SQL Connect genera. Las migraciones complementarias mantienen su propio registro con suma SHA-256. Cada migración y la semilla se aplican en transacciones. El script comprueba el proyecto de emulación, sus endpoints y el origen PGlite antes de ejecutar SQL. [Emulador de SQL Connect](https://firebase.google.com/docs/sql-connect/data-connect-emulator-suite)

## Cómo reproducir la validación

Entorno verificado con Node 26.13.1, Firebase CLI 15.36.0, emulador SQL Connect 3.4.28 y Firebase Web SDK 12.11.0. El emulador usa PGlite basado en PostgreSQL 17.5. Para usar el binario ya instalado en Windows, se puede indicar su ruta al CLI.

```powershell
npm.cmd ci
$env:DATACONNECT_EMULATOR_BINARY_PATH = Join-Path $env:USERPROFILE '.cache/firebase/emulators/dataconnect-emulator-3.4.28.exe'
firebase.cmd dataconnect:sdk:generate --config firebase.local.json --project demo-nexatech --non-interactive
firebase.cmd emulators:exec --config firebase.local.json --project demo-nexatech --only dataconnect,auth 'npm.cmd run test:dataconnect'
```

La suite inicia desde un esquema vacío, aplica las migraciones y la semilla y llama a operaciones con los tres SDK generados. `npm.cmd run seed:dataconnect` también puede ejecutarse como comando de `emulators:exec` si solo se necesita verificar la preparación de datos. El script usa el controlador PostgreSQL de la instalación del CLI. Para una instalación fuera del prefijo global de npm, `NEXATECH_FIREBASE_TOOLS_DIR` puede indicar la carpeta de `firebase-tools`.

En catálogos y reportes, los importes `Int64` se reciben como cadenas de centavos. Las mutaciones de compra y administración devuelven la clave de `CommerceCommand`. La aplicación debe leer su resultado propio con `GetMyCommandResult`, interpretar el código y consultar el recurso de destino. Si el servidor rechaza una clave repetida, se recupera el comando anterior con la misma clave. La compra tiene además claves únicas por carrito y por cotización.

Tras una mutación o un cambio de identidad, las lecturas privadas y de estado deben usar `{ fetchPolicy: 'SERVER_ONLY' }`. Se observó que la política predeterminada del SDK sirvió estados anteriores inmediatamente después de cancelar un pedido y resolver un pago.

## Validaciones de fase C

- El compilador aceptó las 40 tablas y 67 operaciones de los tres conectores. Se generaron los tres SDK. La suite local pasó los cuatro casos de validación.
- La prueba de catálogo verifica las 40 tablas, 18 variantes, seis categorías y seis documentos, además de filtros, unicidad de SKU, stock no negativo y FK de borrado restrictivo.
- La compra de prueba con cupón calcula `84460` centavos en el servidor. Comprueba aceptación de términos, pedido, movimiento, recuperación del reintento, protección de compras ajenas y permiso administrativo. La cancelación restaura el stock y lleva el importe neto del reporte a cero.
- La prueba de pago pendiente seguido por rechazo confirma que las existencias se conservan.
- La prueba de deriva retira una restricción en la base desechable y comprueba que la siguiente escritura devuelve `SCHEMA_INCOMPLETE`.
- La compilación de React pasó. ESLint mantuvo los tres errores de hooks previamente registrados en `src/App.jsx`.

## Reproducción de la fase D en PostgreSQL 18

En Windows se usaron los binarios portátiles PostgreSQL **18.7** de EDB con SHA-256 verificado. Docker estaba ausente. El comando requiere los binarios de PostgreSQL 18, incluida la extensión `uuid-ossp`, Node y Firebase CLI. [Binarios de PostgreSQL para Windows](https://www.postgresql.org/download/windows/)

```powershell
npm.cmd ci
$env:NEXATECH_PG_BIN = 'C:\ruta\a\pgsql\bin'
$env:DATACONNECT_EMULATOR_BINARY_PATH = Join-Path $env:USERPROFILE '.cache/firebase/emulators/dataconnect-emulator-3.4.28.exe'
npm.cmd run test:postgres18
```

El [lanzador](../scripts/local-postgres18.mjs) inicializa un clúster temporal de datos sintéticos en `127.0.0.1`, asigna puertos locales y crea un proyecto de emulación `demo-` único. Copia los contratos GraphQL a un directorio temporal. El emulador de SQL Connect compila las operaciones versionadas (67 al cierre de D y 79 en E3), crea el esquema en el servidor PostgreSQL real y arranca junto con Auth local. La [suite de fase D](../tests/dataconnect-phase-d.test.mjs) reutiliza el inicializador de las **cinco migraciones** y sus sumas SHA-256. Al terminar se detienen los procesos y se eliminan el clúster y los respaldos sintéticos.

Si Firebase CLI tiene otra ubicación, indicar `NEXATECH_FIREBASE_TOOLS_DIR` como en fase C. Si el entorno restringe el directorio de preferencias del CLI, `XDG_CONFIG_HOME` puede apuntar a un directorio temporal para la reproducción de fase C. El lanzador de fase D ya aísla esas preferencias. En este equipo `pg_ctl start` falló al crear un token restringido de Windows. El lanzador inicia `postgres.exe` directamente y conserva `pg_ctl stop` para cerrarlo.

## Resultados en PostgreSQL 18.7

| Evidencia | Resultado observado |
| --- | --- |
| Reproducción de fase C | **4/4 aprobadas** en PGlite 17.5. El compilador aceptó los contratos y se regeneraron los tres SDK. |
| Suite de fase D | **10/10 aprobadas** en PostgreSQL 18.7 nativo con Firebase CLI 15.36.0 y emulador SQL Connect 3.4.28. |
| DB-01 a DB-04. Esquema e integridad | **40 tablas, 72 FK, 32 CHECK, 163 índices, 7 de ellos parciales, y 37 disparadores de usuario**. Todas las FK quedaron validadas y sin borrado en cascada ni `SET NULL`. PostgreSQL rechazó stock negativo, referencia inexistente, borrado restringido, SKU duplicado, nulos obligatorios y edición del diario de inventario. La segunda aplicación de las migraciones y la semilla conservó los 18 movimientos de apertura. |
| TX-01 a TX-04. Concurrencia | Conexiones independientes bajo `READ COMMITTED`. Se verificó la espera de la segunda conexión con `pg_blocking_pids`. La última unidad produjo un pedido y un movimiento, con `STOCK_UNAVAILABLE` para la otra compra. La clave repetida se rechazó con `23505` y devolvió el resultado previo mediante consulta. Con claves y cotizaciones distintas, el segundo intento del mismo carrito obtuvo `CART_UNAVAILABLE`. El último cupón produjo un solo canje y `COUPON_LIMIT` para el otro comprador. |
| PAY-04. Atomicidad | Un fallo inyectado al insertar el pago se propagó después de las escrituras previas del pedido. Se revirtieron pedido, partidas, domicilio, envío, aceptación, movimientos, avisos y comando. El carrito quedó `ACTIVE` y la misma clave pudo completar el reintento. |
| POST-01 a POST-04. Posventa | Se probó la carrera cancelación contra despacho en ambos órdenes. Si ganó la cancelación, el pedido y envío quedaron `CANCELLED`, el pago `REFUNDED` y el stock se repuso. Si ganó el despacho, la cancelación devolvió `CANCELLATION_UNAVAILABLE`. También se verificaron entrega con incidencia, garantía rechazada, límites de unidades entre solicitudes, inspección, dos reembolsos parciales que conciliaron el cobro completo y rechazo del reembolso duplicado. |
| AUTH. Permisos | Las operaciones del SDK comprobaron propiedad, correo verificado para personal y revocación de `SUPPORT` en sesión abierta. `CUSTOMER` quedó fuera de las escrituras administrativas. `SUPPORT` pudo consultar y tramitar expedientes asignados, con denegación de ajuste, reposición a inventario y reembolso. Se comprobó la privacidad de evidencia entre cuentas y entre expedientes. `ADMIN` pudo consultar pedidos, ajustar existencias, inspeccionar con reposición y reembolsar. |
| Rol PostgreSQL de prueba | El rol SQL sintético pudo insertar comandos y recuperar sus resultados. PostgreSQL denegó la edición directa de inventario y de resultados, la lectura directa de evidencias y la llamada a funciones internas. Los roles comerciales se verificaron por SDK. La conexión de arranque del emulador usa al propietario del clúster desechable para crear el DDL. |

El caso `SaveCoupon` descubrió que CEL no podía incluir valores `Timestamp` directamente en el JSON `Any` del comando. El conector ahora convierte las fechas a texto antes de construir el JSON y PostgreSQL conserva la validación `timestamptz`. La firma GraphQL se mantuvo. La prueba de borrado restrictivo registra `23001` en PostgreSQL 18 y la referencia inexistente `23503`.

## Actualización del esquema y recuperación

La suite añade una columna nullable a una copia temporal de `schema.gql` y espera a que SQL Connect termine la recarga. El DDL automático eliminó **32 `CHECK` y 7 índices parciales** y cambió las acciones de borrado de **72 FK**. `commerce_schema_ready()` bloqueó los comandos con `SCHEMA_INCOMPLETE`. La prueba recuperó las **111 definiciones** en una transacción. Comparó restricciones, índices, disparadores y rutinas, verificó las huellas de datos y reanudó las pruebas de escritura con el guard activo. El registro de migraciones conservó sus sumas.

Para una actualización futura, probar primero el DDL en una copia desechable y comparar catálogos completos antes de admitir escrituras. La recuperación probada aplica a la adición compatible ensayada. Los cambios que afecten columnas de una restricción necesitan una migración complementaria revisada para ese cambio. El modo `COMPATIBLE` del servicio administrado y sus privilegios quedan sujetos a validación cuando se autorice ese entorno. [Modos de validación del esquema de SQL Connect](https://firebase.google.com/docs/sql-connect/manage-schemas-and-connectors)

El caso REC-01 creó un respaldo `pg_dump -Fc` y lo restauró en `fdcdb_restore` con `pg_restore --exit-on-error --single-transaction`. El respaldo y la restauración tardaron 4.12 s en la ejecución registrada. Coincidieron las huellas SHA-256 del contenido ordenado de las 40 tablas y del registro de migración, y las definiciones del catálogo. Se verificaron los permisos sobre la copia. Al reconectar el emulador se produjo la misma deriva y se recuperaron los 111 objetos antes de reanudar escrituras. El SDK recuperó el pedido por el UID sintético original y se confirmó una compra nueva exclusivamente en la base restaurada. El ejercicio conserva Auth emulado y los roles SQL del clúster durante la restauración. En otro clúster se deben aprovisionar los roles de PostgreSQL y recuperar la identidad por su procedimiento propio. [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) · [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html)


## Tienda integrada de la fase E1

Desde la raíz del repositorio, con Node, Firebase CLI y los binarios de PostgreSQL 18 que incluyen `uuid-ossp`:

```powershell
npm.cmd ci
$env:NEXATECH_PG_BIN = 'C:\ruta\a\pgsql\bin'
$env:DATACONNECT_EMULATOR_BINARY_PATH = Join-Path $env:USERPROFILE '.cache/firebase/emulators/dataconnect-emulator-3.4.28.exe'
npm.cmd run dev:local
```

Usa la URL local impresa por Vite. El lanzador asigna puertos de loopback a Auth y SQL Connect, inicializa PostgreSQL 18 y prepara las cinco migraciones y las dos semillas. Vite recibe la configuración del proyecto `demo-` y de los puertos asignados. El clúster y los usuarios de Auth son desechables. Cada inicio crea un proyecto de demostración aislado. En una terminal interactiva, escribe `q` y pulsa Enter para cerrar el entorno. Si el CLI se instaló fuera del prefijo global de npm, configura `NEXATECH_FIREBASE_TOOLS_DIR` con la ruta de `firebase-tools`.

Para validación independiente con PGlite, `npm.cmd run seed:dataconnect -- --catalog` aplica la semilla ampliada dentro de `emulators:exec` con `firebase.local.json` y proyecto `demo-nexatech`. Configura los puertos de [.env.example](../.env.example) si inicias `npm.cmd run dev` por separado. Las suites C y D siguen ejecutándose sobre los 18 productos de su escenario original.

### Contratos y límites

- `ListCatalog` filtra por categoría, rango en centavos y existencias en SQL Connect. React obtiene bloques de 30 variantes, agrupa por producto, busca texto normalizado por nombre, marca, descripción y SKU, aplica el orden y presenta páginas de 12 fichas. Los filtros y la página quedan en la URL. `GetProduct` recupera imágenes, datos técnicos y variantes. La ficha y el carrito consultan precio y existencias actuales con `SERVER_ONLY`. [Contratos de tienda](../dataconnect/storefront/queries.gql)
- `EnsureProfile` asocia el UID de Firebase Auth con PostgreSQL y recibe el rol inicial `CUSTOMER` por el disparador existente. `GetMyProfile` devuelve el perfil y los roles del propio UID. `UpdateMyProfile` se confirma con `GetMyCommandResult`. Las vistas de personal exigen verificación de correo y roles asignados en PostgreSQL. Los roles de prueba se crean dentro de la suite con identidades sintéticas. [Contratos de cuenta](../dataconnect/account) · [Contratos de personal](../dataconnect/staff)
- El carrito conserva slug, SKU y cantidad en el navegador y actualiza importes a partir de la variante pública. La ruta `/checkout` presenta una vista previa con subtotal y aviso de cotización pendiente. La persistencia por UID, el flujo de entrega, las operaciones de pago y el PDF pertenecen a E2.

### Reproducción de pruebas E1

Con las mismas variables usadas para iniciar la tienda:

```powershell
npm.cmd run test:e1
npm.cmd run test:postgres18
npm.cmd run lint
npm.cmd run build
```

`test:e1` detecta Chrome y Edge en sus ubicaciones habituales en Windows. Para otras ubicaciones define `NEXATECH_TEST_CHROME` o `NEXATECH_TEST_EDGE` con la ruta del ejecutable. La suite informa cualquier navegador omitido. Si quieres guardar capturas, crea un directorio local y apunta `NEXATECH_E1_SCREENSHOTS_DIR` a él. En el sandbox de Windows de Codex se usó `NEXATECH_TEST_BROWSER_NO_SANDBOX=1` para arrancar los navegadores headless en perfiles desechables. La prueba estándar conserva el sandbox del navegador.

### Resultados del 21 de noviembre de 2026

| Verificación | Resultado observado |
| --- | --- |
| E1 sobre PostgreSQL 18.7 | **5/5 aprobadas**. Reaplicación de semilla sin duplicados, 153 fichas y SKU únicos, 138 movimientos de apertura y 15 variantes agotadas. Coincidieron existencias y diario. Se conservaron 40 tablas, 67 operaciones y las cinco migraciones. |
| Catálogo y acceso | Los SDK confirmaron categorías, datos públicos, precios, existencias, filtros, paginación SQL, perfiles por UID y rechazo de accesos anónimos a cuenta y personal. PostgreSQL rechazó la asignación de `ADMIN` solicitada por un cliente. |
| Navegación y accesibilidad básica | Chrome **157.0.8103.79** y Edge **157.0.4341.60** en modo headless, con comprobaciones a **360, 768 y 1440 px**. Se probaron alta, edición del perfil, login correcto e incorrecto, cierre de sesión, panel por rol, búsqueda y filtros, galería, carrito y favoritos legados, resumen de compra, ayuda, políticas y rutas inexistentes. También se verificaron foco visible, enlace de salto, Escape y retorno de foco del carrito, texto alternativo y contraste mínimo de 4.5:1 en muestras de texto y controles. Se bloqueó SQL Connect y se comprobó el error y la recuperación con Reintentar. |
| Regresiones C y D | **4/4** en PGlite 17.5 y **10/10** en PostgreSQL 18.7. La fase D volvió a demostrar el guard ante deriva, la restauración de 111 objetos y la compra posterior a recuperar la base. En PGlite, el CLI registró `ECONNRESET` durante el cierre después de aprobar los casos, con código de salida 0. |
| Construcción y arranque | `npm.cmd run lint` pasó sin errores y se corrigieron los tres fallos de hooks del prototipo. Vite 8.2.2 compiló en un directorio temporal. `npm.cmd run dev:local` aplicó ambas semillas y sirvió la página inicial con HTTP 200. |

## Compra integrada de la fase E2

Arranca con las mismas variables de PostgreSQL y SQL Connect de E1. En el catálogo agrega una variante, abre el carrito y sigue a **Ver resumen de compra**. Inicia sesión o regístrate con datos ficticios, guarda una dirección en Tamaulipas o Ciudad de México, cotiza y revisa el resumen. El cupón de prueba `DEMO10` está sujeto al mínimo y a los límites configurados. Lee y acepta la versión de los términos mostrada. Selecciona **Pagar mediante simulación académica**. En **Escenario de prueba** puedes elegir un rechazo y volver a cotizar. En la confirmación puedes descargar el comprobante, abrir el historial o regresar al catálogo.

- El identificador del carrito, la dirección, el método `DEMO_PARCEL` y el cupón son la entrada a `QuoteCheckout`. `GetMyQuote` devuelve partidas, entrega, vigencia y todos los importes en centavos MXN. PostgreSQL fija una vigencia de 15 minutos y repite el cálculo, el control de inventario y la revisión de términos al confirmar.
- La selección de visitante admite el formato del prototipo y de E1. Al iniciar sesión, React resuelve los SKU, identifica el lote con una clave idempotente y lo aplica a través de `MergeCart`. Si se pierde la respuesta, el borrador y la clave quedan guardados hasta consultar el resultado. Si se rechaza por disponibilidad, la selección se puede ajustar en el carrito. Los cambios se confirman con `SetCartItem` y `RemoveCartItem` y se vuelven a leer con `GetMyCart`.
- La confirmación utiliza el UUID de cotización como clave idempotente y guarda el intento para recuperarlo desde la misma cuenta si falla la conexión. Un importe, dirección, política o carrito modificado requiere cotizar de nuevo. La compra confirmada convierte el carrito en la transacción de PostgreSQL. El rechazo simulado conserva el carrito.
- El comprobante se genera localmente después de una lectura nueva de `GetMyOrder`. Usa los centavos de las partidas e importes históricos, la dirección de compra, el correo de contacto y el estado del pago. Las fechas se muestran en la zona `America/Matamoros`. La descarga está en la confirmación y en el detalle abierto desde **Mis pedidos**. `ListStaffOrders` y `GetStaffOrder` respaldan la consulta del panel con un `ADMIN` de correo verificado. La suite crea roles de prueba en el clúster desechable.
- El historial y el carrito sobreviven al cierre de sesión y a la recarga mientras el clúster local siga activo. Cada ejecución de `dev:local` crea un clúster y proyecto de Auth desechables nuevos.

### Pruebas y reproducción

```powershell
npm.cmd run dev:local
npm.cmd run test:e2
npm.cmd run test:e1
npm.cmd run test:postgres18
npm.cmd run lint
npm.cmd run build
```

Usa una segunda terminal para las suites si dejas la tienda abierta. `test:e2` usa las mismas rutas de Chrome y Edge que `test:e1`. Para C en PGlite, usa el comando de [validación local](#cómo-reproducir-la-validación).

| Verificación | Evidencia |
| --- | --- |
| Resultados | E2 **2/2**, E1 **5/5**, D **10/10** y C **4/4**. ESLint y la compilación de Vite terminaron correctamente. `dev:local` aplicó las cinco migraciones y ambas semillas y sirvió la tienda en `http://127.0.0.1:5173/` con HTTP 200. |
| Compra desde React | Chrome y Edge guardan, editan y seleccionan direcciones ficticias, aplican el cupón, ven todos los importes, aceptan los términos y recuperan el pedido con folio. La suite compara pedido, partida, pago, versión de términos y salida `SALE` contra PostgreSQL. |
| Idempotencia y recuperación | Pérdida de respuesta después de guardar la fusión del carrito y después de confirmar un pedido, doble envío del formulario y recuperación de la misma cotización tras recargar. La selección local se retira al recuperar una fusión exitosa. La base registra un pedido y un movimiento de venta para la partida. |
| Vigencia, disponibilidad y fallos | Bloqueo de cotización vencida tanto en React como en PostgreSQL, rechazo simulado, inventario agotado después de cotizar y recuperación tras bloquear la conexión del navegador. El formulario controla direcciones incompletas. |
| PDF y acceso | Descarga real desde confirmación e historial. Lectura del PDF y comparación exacta de cada componente monetario con PostgreSQL y React. Un comprobante de prueba de **$1,469.95 MXN** se abrió en el motor PDF de Windows para revisar su presentación. Otro cliente recibe un pedido no disponible y el panel rechaza la consulta con el rol `SUPPORT`. El administrador verificado visualiza el folio y su detalle. |
| Catálogo y presentación | Última página de 13 con las 153 fichas, búsqueda por SKU fuera del primer bloque, anchuras de 360, 768 y 1440 px, etiquetas de formulario, teclado, foco visible y contraste de muestras. |

## Operación y posventa de la fase E3

Inicia `npm.cmd run dev:local` con las variables de E1. Registra una cuenta ficticia para cada rol y completa sus perfiles. Para una demostración manual, usa la conexión **del clúster temporal en loopback** que imprime el emulador. Identifica cada UID en `public.app_user` y asigna `ADMIN` o `SUPPORT` a las respectivas cuentas. El alta general crea únicamente `CUSTOMER`.

```sql
INSERT INTO public.user_role (user_uid, role_code)
VALUES ('UID_FICTICIO_ADMIN', 'ADMIN'), ('UID_FICTICIO_SOPORTE', 'SUPPORT')
ON CONFLICT DO NOTHING;
```

En **Mi perfil**, genera y aplica el enlace de verificación que imprime Auth local y pulsa **Comprobar verificación**. Abre **Panel de personal**. La suite E3 aprovisiona sus propias cuentas, verifica los correos mediante Auth local y trabaja en otro clúster temporal.

| Recorrido | Operación en la interfaz |
| --- | --- |
| Catálogo e inventario | En **Productos**, crea la ficha en borrador, agrega una variante con clase fiscal y precio y registra un ajuste desde su SKU en **Inventario**. Guarda la ficha como activa. Edita la descripción, la marca y el objeto de características que se muestra en la tienda. Puedes volver a borrador, archivar el producto o archivar una variante. Consulta umbrales, movimientos, motivo, UID y fecha en **Inventario**. |
| Pedido y logística | En **Pedidos y envíos** filtra los pagados o en preparación. Abre el folio, prepara, despacha con transportista y guía ficticios, registra eventos y marca la entrega si procede. El comprador abre **Mis pedidos** para consultar fechas, guía, eventos y cambios de estado. Se muestran los 50 eventos logísticos más recientes. |
| Cancelación | En un pedido pagado o en preparación, el comprador solicita la cancelación completa. En **Posventa**, revisa el expediente, autorízalo y ejecuta la cancelación con reembolso simulado. Una solicitud o una decisión que llega después del despacho se rechaza conforme al estado que PostgreSQL confirma en ese momento. |
| Devolución y garantía | El comprador indica unidades por partida para el pedido enviado o entregado y puede adjuntar hasta cinco PNG o JPEG de 256 KiB cada uno. El personal autorizado revisa y solicita información, rechaza o aprueba. Tras marcar **En espera del artículo**, registra recepción y condición. Solo `ADMIN` puede ingresar unidades vendibles o ejecutar el reembolso simulado y la reposición comercial. El expediente conserva resolución, eventos y montos autorizados. |
| Cupones | Configura descuento fijo o porcentual, mínimo y límites. Introduce inicio y fin de vigencia en UTC. Activa o desactiva el cupón desde su ficha. **Canjes registrados** muestra folio, fecha, estado e importe histórico del descuento. El checkout calcula el descuento en PostgreSQL. |
| Soporte | Desde **Mi perfil**, **Ayuda** o el pedido, abre un ticket. Soporte toma casos sin asignar desde la cola o consulta sus expedientes asignados. Puede responder al cliente, guardar una nota interna, esperar respuesta y cerrar con un mensaje. El cliente puede responder, incluso para reabrir un ticket cerrado. Administración puede asignar a personal activo. |
| Reportes | **Resumen** muestra pedidos, ventas netas, unidades vendibles y variantes con bajo inventario. **Reportes** desglosa pedidos por estado, cobros, reembolsos, solicitudes y canjes. Para un periodo de hasta 366 días, muestra el neto diario por fecha de cada cobro o reembolso, la clasificación bruta por SKU y los expedientes por motivo y estado actual. La fecha del periodo es la de Matamoros. |

Las acciones se ejecutan como comandos de los conectores de cuenta y personal. Si se pierde una respuesta, los formularios conservan la clave pendiente en el navegador y la recuperan al reenviar los mismos datos con la misma cuenta. PostgreSQL comprueba propiedad, roles, estados, reservas de unidades y saldos antes de confirmar. Los resultados se leen del servidor después de guardar. [Contratos y permisos](arquitectura-y-validacion.md#operación-integrada-en-e3)

### Reproducción de pruebas E3

```powershell
& $env:DATACONNECT_EMULATOR_BINARY_PATH build --config_dir=dataconnect
& $env:DATACONNECT_EMULATOR_BINARY_PATH sdk generate --config_dir=dataconnect
npm.cmd run test:e3
npm.cmd run test:e2
npm.cmd run test:e1
npm.cmd run test:postgres18
npm.cmd run lint
npm.cmd run build
```

`test:e3` usa Chrome y Edge en modo headless y verifica la interfaz y consultas independientes a PostgreSQL. Las variables de ubicación de los navegadores y el modo del sandbox están en la sección de [pruebas E1](#reproducción-de-pruebas-e1). Para reproducir los casos de navegador dentro del sandbox de Windows de Codex se configuró `NEXATECH_TEST_BROWSER_NO_SANDBOX=1`.

### Resultados de E3 del 21 de noviembre de 2026

| Prueba | Evidencia ejecutada |
| --- | --- |
| E3 en Chrome y Edge | **2/2**. Se verificaron las 153 fichas iniciales, alta y edición de producto y variante, ajuste con UID y bitácora, alerta de stock, descuentos fijos y porcentuales, vigencia, desactivación y canje. |
| Compras y entregas | Se compró mediante el conector de cuenta y el folio apareció en el panel. Se verificaron preparación, despacho, incidencia y entrega, incluidos eventos en PostgreSQL y guía en la cuenta del comprador. |
| Posventa | Cancelación previa al despacho y rechazo posterior al despacho, devolución por partida, evidencia privada, inspección, reembolso parcial y reposición de garantía. PostgreSQL rechazó cantidades en exceso y reintentos de reembolso e inspección con otra clave. El ajuste cuya respuesta se perdió quedó como un solo movimiento y un registro de auditoría tras reenviar. |
| Soporte y permisos | Se abrió un ticket asociado, se tomó desde la cola, se respondió, se registró una nota interna y se cerró. El cliente respondió a su expediente. Se verificaron aislamiento de clientes, permiso por asignación, denegación de escrituras y lecturas administrativas para `CUSTOMER` y `SUPPORT`, y correo verificado. |
| Reportes y experiencia | Se conciliaron existencias, alertas, pedidos por estado, centavos, devoluciones y canjes con SQL independiente. Se comprobó navegación, etiquetas, tecla Tab, foco visible, respuesta a un fallo y ausencia de desbordamiento a 360, 768 y 1440 px. |
| Regresiones y construcción | E2 **2/2**, E1 **5/5** y D **10/10** en PostgreSQL 18.7. Compilaron los 79 contratos y se generaron los SDK. ESLint y Vite terminaron correctamente. |

Las pruebas de interfaz se realizaron en perfiles desechables con Chrome 157.0.8103.79 y Edge 157.0.4341.60. En una ejecución concurrente, E1 agotó el tiempo de espera del carrito en Edge. La repetición aislada pasó los cinco casos. Los escenarios de verificación añadieron fichas y compras únicamente en los clústeres temporales.

### Continuidad en F y preparación remota

1. Relaciona las pp. 4–5, 7–8 y 11 del PDF académico con las pantallas y pruebas de E3. Completa la matriz de las 15 páginas, los diagramas operativos, la colección de operaciones GraphQL con ejemplos de permisos y errores, los manuales con capturas y la ficha técnica. Usa los criterios de evaluación de las pp. 12–15 para revisar la entrega.
2. Reproduce con datos ficticios la compra con cupón, el despacho, la falta de stock, el reembolso o la garantía, y el soporte. Incluye evidencias del diario de inventario, documentos legales versionados, conciliación, copia de respaldo y restauración de D.
3. Para preparar un paso remoto autorizado, inventaría los recursos existentes y verifica el plan y la vigencia de la prueba. Ensaya en un destino desechable el diff de DDL, los privilegios, la restauración de las protecciones y el aprovisionamiento de identidades. Revisa las políticas definitivas de entrega, garantía, cancelación y privacidad y documenta respaldo y reversión antes de autorizar cada cambio.

## Configuración de compilación desde G1

`npm.cmd run dev:local` usa los emuladores. El comando de build requiere la configuración pública de la aplicación web para Hosting. Para ensayar el build en un directorio temporal con valores sintéticos, seguir la [validación local de G1](preparacion-publicacion-g1.md#validación-local-de-g1).

