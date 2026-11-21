# Estado actual de NexaTech

Corte del 21 de noviembre de 2026. La integración final conserva PostgreSQL y SQL Connect en `nexatech-58ce3` con Firebase Spark. El [procedimiento de G1](preparacion-publicacion-g1.md) conserva el diagnóstico histórico y los controles de migración. El destino y el estado remoto vigentes son los de este documento.

## Integración final

- Cloud SQL confirmó que `nexatech-58ce3-database` estaba ausente y la creó con autorización en la instancia de prueba `nexatech-postgres` (`us-south1`). La operación `da5312b5-e36f-4861-bedb-fece00000052` terminó en `DONE` y la consulta directa y el listado muestran la base. Cloud Billing confirmó `billingEnabled: false` antes y después. SQL Connect registra el destino y mantiene `ephemeral: true`, `reconciling: false` y cero archivos GraphQL.
- La validación `COMPATIBLE` con `validateOnly=true` devolvió HTTP 400 `FAILED_PRECONDITION` con `INACCESSIBLE_SCHEMA`. Entregó un DDL de referencia de 40 tablas y 116 índices sin `DROP` ni `TRUNCATE`, guardado en `%TEMP%\nexatech-integracion-ddl-referencia.sql`. `001_constraints.sql` reemplaza las FK de `public` con acciones `CASCADE` o `SET NULL` por `RESTRICT`. Data API devolvió HTTP 400 porque está deshabilitada y la consulta del usuario PostgreSQL de la identidad IAM actual devolvió HTTP 404. La instancia tiene cero respaldos registrados.
- El YAML local apunta a `nexatech-58ce3-database` y declara `COMPATIBLE` en el nivel que lee Firebase CLI 15.36.0. PGlite usa ese nombre en loopback, y el lanzador nativo mantiene `fdcdb` en su copia temporal. Auth devuelve HTTP 404 `CONFIGURATION_NOT_FOUND` y hay cero aplicaciones web. Hosting tiene solo `live`, versión `5f7276519c6b9ff8`, con reescritura a `/index.html`. `/`, `/productos` y `/checkout` responden HTTP 200.
- Pasaron la compilación de SQL Connect, PGlite **4/4** y PostgreSQL 18 **10/10** tras aislar la configuración de emulación. PostgreSQL recuperó las 111 protecciones y validó la restauración local. El catálogo de referencia quedó en `%TEMP%\nexatech-integracion-catalogo-referencia.jsonl`.
- El siguiente paso es completar la vinculación efectiva de la base creada dentro de la prueba Spark y repetir la validación de acceso. Verificar el contenido y el diff antes de presentar el DDL y las cinco migraciones para autorización. Ante datos existentes, tomar un `pg_dump -Fc` y ensayar su restauración local. Aplicar cada cambio revisado en transacción y ejecutar `ROLLBACK` ante un error. Comparar catálogo y privilegios con [schema-audit.sql](../scripts/schema-audit.sql) y [runtime-audit.sql](../scripts/runtime-audit.sql). La vista previa y `live` requieren sus propias autorizaciones.

## Punto de partida

| Área | Estado verificable |
| --- | --- |
| Repositorio | `C:\Users\Gustambo Alonso\Documents\GitHub\NEXA-TECH`, PowerShell. E1 empezó con `main` en `81de9dc` (`Cambios A y B`) y las fases C y D en el árbol local. E1 se construyó sobre ese trabajo. Revisar `git status --short --branch --untracked-files=all` al retomar. |
| Frontend activo | React 19.2.8 y Vite 8.2.2. Tienda, carrito, compra académica, comprobante e historial con seguimiento y posventa. Panel de personal con productos, inventario, pedidos y envíos, cupones, expedientes, soporte y reportes sujetos al rol. |
| SQL Connect local | 40 tablas, 80 operaciones y SDK de `storefront`, `account` y `staff`. Cinco migraciones complementarias. El modo tienda carga 153 fichas y seis categorías, con 50 fichas en cada categoría principal y tres fichas complementarias históricas. [Datos e imágenes](catalogo-e1.md) |
| Entorno de pruebas | Fase C con `demo-nexatech`, PGlite 17.5 en `127.0.0.1:9543`, Auth en `127.0.0.1:9099` y SQL Connect en `127.0.0.1:9399`. Fase D con PostgreSQL 18.7 nativo, Auth y SQL Connect en puertos locales temporales y un proyecto `demo-` único. Versiones comprobadas de Node 26.13.1, Firebase CLI 15.36.0, emulador 3.4.28 y Firebase Web SDK 12.11.0. |
| Backend y Hosting remotos | [Verificación de integración final](#integración-final). La expiración oficial de la prueba queda pendiente. |
| Referencia académica | `C:\Users\Gustambo Alonso\Downloads\DISEÑO Y DESARROLLO DE TIENDA VIRTUAL TSTI.pdf`, 15 páginas. El diagnóstico y el plan contienen referencias de página. Si el PDF queda fuera del acceso de la próxima sesión, volver a adjuntarlo antes de cerrar la matriz de cumplimiento. |

## Decisiones técnicas que debe conservar la siguiente fase

- **Fuentes de verdad.** Firebase Auth identifica a la persona por UID. PostgreSQL gobierna roles de negocio `CUSTOMER`, `ADMIN` y `SUPPORT`, importes en centavos MXN, stock por variante y las transiciones del pedido. SQL Connect expone operaciones nombradas con proyecciones y controles de propiedad. La configuración de tienda tiene un almacén, un envío y un cupón por pedido.
- **Esquema y restricciones.** `schema.gql` es la línea base versionada y SQL Connect genera el DDL inicial. Las migraciones SQL agregan restricciones de dominio, índices parciales, claves foráneas restrictivas, disparadores y rutinas. El inicializador local aplica cada archivo en una transacción y registra su huella SHA-256. La semilla es repetible.
- **Compra.** La mutación escribe un `CommerceCommand` asociado al UID y a una clave idempotente. PostgreSQL ejecuta la operación y conserva un resultado que el cliente obtiene con `GetMyCommandResult`. Un carrito o una cotización pueden originar un solo pedido. La confirmación vuelve a calcular precio, cupón, impuestos, entrega y existencias. Guarda el pedido, el pago simulado, la dirección y partidas históricas, la aceptación de términos y los movimientos de inventario en una transacción.
- **Estados recientes.** Leer el resultado de comandos, pedidos, pagos y otras vistas privadas con `{ fetchPolicy: 'SERVER_ONLY' }` tras escribir o cambiar de identidad. El SDK entregó estados anteriores con su política predeterminada durante las primeras pruebas.
- **Deriva del esquema.** La recarga automática del emulador retiró `CHECK`, índices parciales y acciones de FK en PostgreSQL 18. `commerce_schema_ready()` bloqueó las escrituras con `SCHEMA_INCOMPLETE`. La prueba de actualización repuso las definiciones en una transacción y comprobó el catálogo y el comportamiento antes de habilitar escrituras. Para los cambios de desarrollo, iniciar una ejecución desechable limpia para aplicar la línea base y las migraciones. Para el entorno administrado queda pendiente ensayar su propio DDL y sus privilegios con autorización.

## Archivos entregados

| Archivo o ruta | Cambio |
| --- | --- |
| [dataconnect.yaml](../dataconnect/dataconnect.yaml), [schema.gql](../dataconnect/schema/schema.gql), [staff.gql](../dataconnect/schema/staff.gql) | Configuración de los conectores, modelo de 40 tablas y vistas autorizadas del personal. Se retiró `dataconnect/example/connector.yaml` al reemplazarlo por conectores válidos. |
| [storefront](../dataconnect/storefront), [account](../dataconnect/account), [staff](../dataconnect/staff) | YAML y contratos GraphQL de catálogo, cuenta y personal. Las firmas vigentes están en estos archivos y en el SDK generado. |
| [migraciones SQL](../dataconnect/migrations) | `001_constraints.sql` para restricciones e índices, `002_checkout.sql` para cotización y compra, `003_account_and_admin.sql` para cuenta y administración, `004_post_sale.sql` para logística y posventa, `005_dispatch.sql` para reembolsos, reposición y despacho transaccional de comandos. |
| [demo.sql](../dataconnect/seed/demo.sql) | Semilla académica con catálogo, inventario de apertura, tasas, entrega simulada, cupón y textos de prueba. Las imágenes ilustrativas del prototipo aún requieren verificación de derechos para el catálogo final. |
| [firebase.local.json](../firebase.local.json), [local-dataconnect.mjs](../scripts/local-dataconnect.mjs), [pruebas de fase C](../tests/dataconnect-phase-c.test.mjs) | Lanzamiento local, aplicación controlada de SQL y semilla, pruebas a través de los SDK. |
| [local-postgres18.mjs](../scripts/local-postgres18.mjs), [pruebas de fase D](../tests/dataconnect-phase-d.test.mjs) | Clúster desechable de PostgreSQL 18, SQL Connect y Auth local. Regresión de esquema, transacciones, concurrencia, permisos, posventa, actualización y restauración. |
| [SDK generados](../src/dataconnect-generated), [package.json](../package.json), [package-lock.json](../package-lock.json) | Dos formatos JavaScript y declaraciones TypeScript por conector, dependencia Firebase y scripts `test:dataconnect` y `seed:dataconnect`. Regenerar cuando cambien los contratos. |
| [.gitignore](../.gitignore), [eslint.config.js](../eslint.config.js), [README.md](../README.md) | Exclusión del estado del emulador y guías generadas, exclusión del SDK generado del lint y acceso a la documentación. |
| [Diagnóstico](diagnostico-nexatech.md), [modelo relacional](modelo-relacional.md), [arquitectura y validación](arquitectura-y-validacion.md), [implementación local](implementacion-local.md) | Auditoría, diagrama y diccionario, arquitectura, matriz técnica de pruebas y resultados reproducibles. |

## Comandos y resultados

Ejecutar desde la raíz del repositorio. `npm.cmd ci` es el paso de instalación para un checkout limpio. En fase C se instaló la dependencia nueva con `npm.cmd install firebase@^12.11.0` y se generó el lockfile.

```powershell
git status --short --branch --untracked-files=all
npm.cmd ci
$env:DATACONNECT_EMULATOR_BINARY_PATH = Join-Path $env:USERPROFILE '.cache/firebase/emulators/dataconnect-emulator-3.4.28.exe'
firebase.cmd dataconnect:sdk:generate --config firebase.local.json --project demo-nexatech --non-interactive
firebase.cmd emulators:exec --config firebase.local.json --project demo-nexatech --only dataconnect,auth 'npm.cmd run test:dataconnect'
npm.cmd run lint
```

Si `git` falta en el PATH, en este equipo funcionó el binario de GitHub Desktop bajo `%LOCALAPPDATA%\GitHubDesktop\app-3.6.11\resources\app\git\cmd\git.exe`. El CLI puede usar la ruta del emulador local indicada arriba si intenta descargar otra versión. Para una instalación del CLI fuera del prefijo global de npm, `NEXATECH_FIREBASE_TOOLS_DIR` señala su carpeta de `firebase-tools`. Aplicar solo las migraciones y semilla dentro de `emulators:exec` se puede hacer con `npm.cmd run seed:dataconnect`.

| Verificación | Resultado de fase C |
| --- | --- |
| Compilador y generación | `build --config_dir=dataconnect` con el binario del emulador aceptó el esquema. `firebase.cmd dataconnect:sdk:generate` generó correctamente los tres SDK. |
| Integración local | **4 de 4 casos aprobados.** Catálogo y restricciones. Compra de **$844.60 MXN**, aislamiento entre clientes, permisos de personal, reintento y cancelación con devolución de existencias. Pago pendiente seguido de rechazo sin afectar stock. Bloqueo de escritura por deriva con `SCHEMA_INCOMPLETE`. |
| Frontend | `npm.cmd run build -- --outDir <directorio temporal>` compiló correctamente. |
| ESLint | Tres fallos preexistentes en [src/App.jsx](../src/App.jsx). En la línea 15, `stored` invoca `useState` y `useEffect` sin declararse como hook. En la línea 30, `useParams` se llama dentro de un callback de búsqueda. Resolver durante la integración y probar navegación entre fichas. |

## Cierre de la fase D

- La repetición en PGlite 17.5 dio **4/4 pruebas aprobadas** y PostgreSQL 18.7 dio **10/10**. La validación nativa conservó **40 tablas, 67 operaciones y cinco migraciones**. La concurrencia dejó un único pedido o canje en las carreras por la última unidad, el mismo carrito, la misma clave y el último cupón.
- Se verificaron la reversión atómica de una compra, la carrera entre cancelación y despacho en ambos sentidos, devoluciones con inspección, reembolsos simulados, conciliación de existencias y permisos `CUSTOMER`, `ADMIN` y `SUPPORT`. Se corrigió la serialización de fechas de `SaveCoupon` en el conector, con la misma firma GraphQL.
- El ensayo de actualización recuperó las **111 protecciones** que el emulador retiró o cambió. El respaldo y la restauración compararon el catálogo y los datos, recuperaron un pedido con su UID original y permitieron otra compra sobre la copia. La guía detalla la ejecución con `npm.cmd run test:postgres18` y los límites del ensayo. [Guía de fase D](implementacion-local.md)
- La compatibilidad del DDL administrado y los privilegios de ese entorno deben comprobarse antes de una operación remota autorizada.

## Cierre de la fase E1

- El router conserva las URLs históricas. `/producto/1` a `/producto/6` resuelven los slugs originales y conservan los UUID y SKU de PostgreSQL. Categoría, rango de precio y disponibilidad se consultan en SQL Connect. React agrupa variantes por ficha, busca por nombre, marca, descripción y SKU, ordena y muestra 12 fichas por página.
- Firebase Auth emulado registra, inicia y cierra sesiones. PostgreSQL crea el perfil `CUSTOMER` para el UID y permite editar los datos del titular. Los roles se leen desde la cuenta autenticada. `ADMIN` verificado puede leer alertas de inventario y soporte. `SUPPORT` verificado puede leer sus casos y casos sin asignar. La autorización se aplica en los conectores y las vistas de PostgreSQL.
- Carrito y favoritos se guardan en el navegador. El carrito resuelve cada SKU en el backend antes de presentar importes y disponibilidad. El checkout muestra un subtotal estimado. Direcciones, cotización, confirmación y comprobante se integrarán en E2.
- Pasaron **5/5 pruebas E1**, incluidas Chrome y Edge, **10/10 de la fase D** y **4/4 de la fase C**. También pasaron ESLint y el build de Vite. [Resultados y comandos](implementacion-local.md#tienda-integrada-de-la-fase-e1)
- En el PDF académico, las pp. 3–4 cubren catálogo, experiencia responsive, galería, precio, stock, cuenta, ayuda y políticas. La p. 11 orienta las pruebas de teclado, foco, contraste, texto alternativo y acceso. La compra completa y su consulta administrativa siguen como condición de aceptación de la p. 2. [Verificación técnica](implementacion-local.md#tienda-integrada-de-la-fase-e1)

### Registro de archivos de E1

| Rutas | Cambios |
| --- | --- |
| [App.jsx](../src/App.jsx), [App.css](../src/App.css), [index.css](../src/index.css), [index.html](../index.html), [favicon.svg](../public/favicon.svg), [layouts](../src/layouts), [componentes](../src/components) | Router, estilos, encabezado, navegación, pie y componentes compartidos. |
| [Páginas](../src/pages) | `home.jsx`, `products.jsx`, `productdetail.jsx`, `cart.jsx`, `wishlist.jsx`, `checkout.jsx`, `login.jsx`, `profile.jsx`, `help.jsx` y `admin.jsx`. |
| [Contextos](../src/context), [hooks](../src/hooks), [biblioteca](../src/lib), [.env.example](../.env.example) | `auth-session.js`, `authcontext.jsx`, `basket.js`, `cartcontext.jsx`, `useResource.js`, `userlocalstorage.js`, `firebase.js`, `account.js` y `catalog.js`. |
| [storefront/queries.gql](../dataconnect/storefront/queries.gql), [account/queries.gql](../dataconnect/account/queries.gql), [SDK generados](../src/dataconnect-generated) | Metadatos públicos de fichas y roles del UID autenticado. Se regeneraron los tres SDK. |
| [catalog-e1.sql](../dataconnect/seed/catalog-e1.sql), [recursos gráficos](../public/catalogo), [registro de catálogo](catalogo-e1.md) | Datos académicos, conciliación inicial, imágenes propias y atribución. |
| [package.json](../package.json), [scripts](../scripts), [pruebas E1](../tests/dataconnect-phase-e1.test.mjs), [utilidad de navegador](../tests/helpers/local-browser.mjs) | Arranque y pruebas. Scripts `local-dataconnect.mjs`, `local-postgres18.mjs` y `local-store.mjs`. |
| [README](../README.md), [guía local](implementacion-local.md), [este documento](ESTADO_ACTUAL_NEXATECH.md) | Estado, evidencia, registro de archivos y traspaso a E2. |

## Cierre de la fase E2

- El carrito de visitante conserva SKU y cantidades. Al iniciar sesión, React resuelve las variantes y usa `MergeCart` con una clave guardada en el navegador. Quita la selección local al confirmar el resultado de PostgreSQL. Las lecturas y los cambios del carrito autenticado usan el UID vigente.
- El checkout guarda y edita direcciones ficticias, cotiza la entrega y el cupón, y presenta la versión de términos incluida en la cotización. PostgreSQL confirma el pedido y guarda el pago simulado, las partidas, los movimientos de inventario y la aceptación en la transacción existente.
- La confirmación y el historial consultan el pedido propio. El PDF usa los importes históricos en centavos, el domicilio de la compra, su correo de contacto y el estado actual del pago simulado. El panel de administración lista los pedidos recibidos y abre su detalle con un `ADMIN` verificado.
- Las pruebas de E2 en Chrome y Edge verifican la fusión idempotente del carrito, la compra, la exactitud del PDF, la consulta administrativa y el aislamiento entre cuentas. [Resultados y comandos](implementacion-local.md#pruebas-y-reproducción)
- La revisión del PDF académico vinculó el recorrido de compra y consulta administrativa con la p. 2, la experiencia y el resumen de compra con las pp. 3–4, la transacción y el flujo de entrega con las pp. 5–7, los términos versionados con la p. 9 y las pruebas con la p. 11. La demostración de posventa y la matriz completa se conservan como trabajo de E3 y F. [Validación y alcance](implementacion-local.md#compra-integrada-de-la-fase-e2)

### Registro de archivos de E2

| Rutas | Cambios |
| --- | --- |
| [Carrito y sesión](../src/context/cartcontext.jsx), [comercio](../src/lib/commerce.js), [configuración local](../src/lib/firebase.js), [carrito](../src/pages/cart.jsx) | Persistencia por UID, reconciliación idempotente de la selección de visitante, lecturas propias, reintentos y estado de existencias. |
| [Checkout](../src/pages/checkout.jsx), [direcciones](../src/components/delivery.jsx), [componentes de compra](../src/components/purchase.jsx) | Selección y edición de direcciones, entrega, importes autorizados, aceptación y pago simulado. |
| [Comprobante PDF](../src/lib/receipt.js), [historial y confirmación](../src/pages/orderconfirmation.jsx), [lista de pedidos](../src/components/orders.jsx), [panel de personal](../src/pages/admin.jsx) | Pedidos propios, comprobante y consulta administrativa. |
| [Router](../src/App.jsx), [estilos](../src/App.css), [controles](../src/components/ui.jsx), [fichas](../src/components/product-card.jsx), [detalle de producto](../src/pages/productdetail.jsx), [acceso](../src/pages/login.jsx), [perfil](../src/pages/profile.jsx), [ayuda](../src/pages/help.jsx) | Rutas, estados de carga y acciones de cuenta, integración con el catálogo y presentación responsive. |
| [Proyección de cuenta](../dataconnect/account/queries.gql), [SDK de cuenta](../src/dataconnect-generated/account) | `GetMyOrder` incluye el correo histórico y el estado del pago dentro del filtro propio existente. Se conservan 40 tablas, 67 operaciones y cinco migraciones. |
| [Lanzador local](../scripts/local-postgres18.mjs), [scripts de npm](../package.json), [suite E2](../tests/dataconnect-phase-e2.test.mjs), [regresión E1](../tests/dataconnect-phase-e1.test.mjs) | Suite nueva de compra y actualización de los casos de carrito que ahora opera por cuenta. |
| [Guía local](implementacion-local.md), [este documento](ESTADO_ACTUAL_NEXATECH.md) | Escenarios, verificación, decisiones y continuidad. |

## Cierre de la fase E3

- **ADMIN verificado** crea productos y variantes, edita precio y disponibilidad, ajusta existencias con auditoría, opera envíos ficticios, gestiona promociones y decide cancelaciones, reembolsos y reposiciones. Los reportes distinguen el estado actual del pedido de los cobros y reembolsos que lo componen.
- **CUSTOMER** consulta su seguimiento y abre solicitudes desde cada pedido elegible. Puede ver estados, historial, resolución y evidencia de sus expedientes, además de iniciar y continuar tickets. **SUPPORT verificado** toma casos de la cola y consulta el contenido asignado. Puede gestionar la revisión, inspeccionar sin reingreso a stock y responder a tickets con mensajes públicos o notas internas.
- Las 12 operaciones nuevas son lecturas protegidas. La fase usa las mutaciones, bloqueos y validaciones de PostgreSQL de C y D y agrega vistas que proyectan catálogo, promociones, personal y reportes. Se conservan las 40 tablas, las cinco migraciones y la semilla de 153 fichas.
- E3 pasó **2/2** en Chrome y Edge y las regresiones E2 y D pasaron **2/2** y **10/10**. Las pruebas de E3 verifican PostgreSQL además de la interfaz. [Comandos y resultados](implementacion-local.md#resultados-de-e3-del-21-de-noviembre-de-2026)
- El PDF académico relaciona las pantallas y el backend con las pp. 4–5, la logística con la p. 7, la posventa con la p. 8 y las pruebas con la p. 11. F debe completar la trazabilidad y los entregables académicos. [Guía local y continuidad](implementacion-local.md#operación-y-posventa-de-la-fase-e3)

| Rutas modificadas en E3 | Trabajo realizado |
| --- | --- |
| [Panel de personal](../src/pages/admin.jsx), [componentes](../src/components) | Navegación por rol y módulos `staff-orders.jsx`, `staff-catalog.jsx`, `staff-coupons.jsx`, `staff-cases.jsx` y `staff-reports.jsx`. |
| [Router](../src/App.jsx), [estilos](../src/App.css), [historial](../src/pages/orderconfirmation.jsx), [perfil](../src/pages/profile.jsx), [ayuda](../src/pages/help.jsx), [acceso](../src/pages/login.jsx) | Rutas de cuenta y personal, seguimiento y entrada a expedientes, estilos responsivos y retorno al inicio de sesión. `customer-returns.jsx`, `customer-support.jsx`, `cases.jsx`, `shipment.jsx`, `operations.jsx` y `purchase.jsx` contienen los formularios y componentes. |
| [Lógica de cliente](../src/lib), [vistas](../dataconnect/schema/staff.gql), [cuenta](../dataconnect/account/queries.gql), [personal](../dataconnect/staff/queries.gql), [SDK](../src/dataconnect-generated) | Lecturas `SERVER_ONLY`, reintentos por cuenta, proyecciones autorizadas y SDK JavaScript y TypeScript regenerados. |
| [Lanzador](../scripts/local-postgres18.mjs), [npm](../package.json), [suite E3](../tests/dataconnect-phase-e3.test.mjs), [regresión D](../tests/dataconnect-phase-d.test.mjs) | Comando de fase E3, recorridos desde Chrome y Edge, comparación con PostgreSQL e inventario de contratos actualizado. |
| [Guía local](implementacion-local.md), [arquitectura](arquitectura-y-validacion.md), este registro | Operación, comprobaciones y preparación de F y del entorno remoto. |

## Cierre técnico de G1

Al iniciar, `main` apuntaba a `81de9dc` y estaba alineada con la referencia local de `origin/main`. Las fases C a E3 estaban en archivos modificados y sin seguimiento. Se conservaron esos cambios. Antes de publicar se requiere una revisión que incluya todas las fuentes, migraciones, semillas, SDK y pruebas del candidato.

| Módulo | Resultado de la auditoría |
| --- | --- |
| Catálogo | 153 fichas académicas en PostgreSQL, SKU y stock por variante e imágenes incluidas en el repositorio. Los filtros de categorías, importe y disponibilidad consultan SQL Connect. React agrupa, ordena y busca dentro del conjunto obtenido. |
| Identidad y cuenta | Implementados registro, acceso, cierre de sesión y perfil por UID. G1 añadió solicitud de recuperación por Firebase y ajustó los avisos de verificación para el SDK local y remoto. Los permisos de personal requieren correo verificado y rol vigente en PostgreSQL. |
| Carrito y favoritos | El carrito autenticado persiste por UID y revalida stock, precio y disponibilidad. G1 corrigió favoritos autenticados conectándolos a `ListMyFavorites` y `SetFavorite`. La selección heredada de visitantes se conserva en ese navegador. |
| Compra y PDF | Cotización, confirmación y reintentos procesados en PostgreSQL. `payment` exige `SIMULATED`. El comprobante usa importes y partidas históricos e indica compra académica y ausencia de validez fiscal. El formulario de pago recibe escenarios del simulador. |
| Inventario, pedidos, seguimiento y administración | Ajustes, movimientos, auditoría, stock bajo, pedidos, despacho y eventos consultados o escritos mediante conectores. G1 agregó consulta administrativa de clientes y alta, edición y archivo reversible de categorías mediante SQL Connect. El panel consulta los roles. El aprovisionamiento del primer administrador es un procedimiento autorizado. |
| Devoluciones, garantías, soporte, cupones y reportes | Los expedientes, evidencia, reembolsos, reposiciones, tickets y respuestas usan PostgreSQL. Las vistas de personal filtran por rol y asignación. Los cupones se validan dentro de la cotización y la compra. Los reportes derivan sus totales de pedidos, inventario, pagos y eventos. |
| Compilación y Hosting | G1 separó la inicialización de Firebase por comando de Vite. Desarrollo usa el proyecto `demo-` y puertos de emulador. El build apunta a `nexatech-58ce3`, exige la configuración web y se ejecuta también en el `predeploy` de Hosting. La reescritura a `index.html` permite abrir rutas React directamente. |
| Protección de las migraciones | El catálogo [schema-audit.sql](../scripts/schema-audit.sql) detecta cambios en restricciones, índices, disparadores, rutinas y demás objetos. [runtime-audit.sql](../scripts/runtime-audit.sql) permite comprobar los privilegios del login de ejecución. D provocó deriva y recuperó 111 protecciones en el clúster desechable. |

La guía académica de 15 páginas se revisó mediante su extracción de texto. Las pp. 2 y 4–8 cubren la compra de aceptación, administración y posventa. La p. 11 exige pruebas de roles, inventario y recuperación. Las pp. 12–15 dejan los manuales y evidencias institucionales para F, después de validar la URL pública. Los conectores de reseñas, administración de documentos, gestión de roles y notificaciones conservan su contrato. La interfaz de G1 cubre el alcance indicado en la tabla.

**Validación final local:** E3 **2/2**, E2 **2/2**, E1 **5/5**, D **10/10**. ESLint pasó. Vite compiló para producción con configuración sintética en un directorio temporal. El emulador de Hosting sirvió las rutas React, y Chrome verificó los destinos HTTPS de Auth y SQL Connect sin emitir peticiones a emuladores. El build sin configuración web se detuvo como se esperaba. [Resultados y reproducción](preparacion-publicacion-g1.md#validación-local-de-g1)

## Próximas fases y criterios de cierre

| Etapa | Trabajo pendiente | Evidencia esperada |
| --- | --- | --- |
| **F. Cumplimiento académico completo** | Cerrar el PDF mediante una matriz de trazabilidad por página y apartado. Incluir alcance, negocio y competidores, RF/RNF, diagramas y diseño UX, frontend, API, base, logística, operación, privacidad y consumo, seguridad, pruebas, manuales, ficha técnica y demostración. Registrar también recomendaciones del PDF y su resolución. Revisar documentos legales con fuentes oficiales vigentes antes de publicar. | Cada requisito obligatorio tiene un responsable, una prueba o evidencia y un estado verificable. Cerrar brechas antes de declarar cumplimiento. La demostración incluye compra de extremo a extremo, consulta administrativa, falta de inventario y devolución o garantía. |
| **Publicación autorizada en Spark** | Completar la base PostgreSQL vinculada y verificar el DDL y los privilegios. Desplegar los conectores, configurar Auth e importar el catálogo con las autorizaciones correspondientes. | Comparación de DDL y permisos, recuperación verificable, E2E en vista previa y aprobación separada para `live`. |

La guía del curso admite pago simulado para la compra de prueba. Para la matriz académica, cotejar las pp. 2–4 para alcance, análisis, UX y requisitos transversales. Las pp. 5–8 cubren API, base y operación comercial. Las pp. 9–11 cubren marco normativo, seguridad y calidad. Las pp. 12–15 cubren manuales, entregables, rúbrica, defensa y lista de aceptación. Conservar los elementos de planeación que pide el PDF, incluidos análisis de tres competidores, historias con criterios, casos de uso, tres flujos de actividad, backlog, cronograma, RACI y registro de riesgos.

## Instrucción para abrir una nueva sesión de Codex

Retomar desde la verificación de integración final y los controles de publicación de la guía enlazada. Copiar al iniciar la fase F tras validar el sitio público.

> Abre NexaTech, revisa Git y conserva las fases anteriores. Lee el estado actual, la guía local, la arquitectura, el modelo relacional y las 15 páginas del PDF académico. Reproduce D, E2 y E3. Completa la matriz por requisito y reúne los manuales, diagramas, documentación GraphQL, ficha técnica y evidencias de la demostración. Registra las brechas y sus pruebas. Prepara la lista de decisiones sobre el entorno administrado. Cualquier paso remoto requiere autorización explícita.
