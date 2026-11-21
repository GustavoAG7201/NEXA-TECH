# Instalación autónoma de NexaTech

## Computadora local

Usa Node.js 24 o posterior y PostgreSQL 18. Si `postgres`, `pg_ctl` y los demás binarios no están en `PATH`, define `NEXATECH_PG_BIN` antes de la instalación. En Windows ejecuta los comandos con `npm.cmd` si PowerShell bloquea `npm.ps1`.

```powershell
$env:NEXATECH_PG_BIN = 'C:\ruta\a\pgsql\bin'
npm.cmd ci
npm.cmd run local:setup
npm.cmd run dev
```

Abre <http://127.0.0.1:5173>. La API usa el puerto 8787 y el clúster persistente usa 55432. `APP_ORIGIN`, `API_PORT` y `NEXATECH_LOCAL_PG_PORT` permiten elegir los puertos. Define el puerto de PostgreSQL antes de `local:setup` para que coincida con las dos URL generadas. Para detener la tienda pulsa Ctrl+C. `npm run local:stop` detiene el clúster propio sin borrar datos y `npm run dev` lo inicia de nuevo.

`npm run admin:first -- correo-administrador@example.org "Administración NexaTech"` crea una cuenta nueva desde la consola del propietario PostgreSQL. El comando pide la contraseña sin mostrarla, verifica que todavía no exista un ADMIN y marca como verificada la dirección que el operador confirma controlar. Crea el administrador solo después de controlar su dirección y antes de abrir el registro al público. En el panel **Cuentas**, un ADMIN puede conceder o retirar roles ADMIN y SUPPORT. Cada cuenta de personal requiere verificar su correo antes de usar el panel.

## Instalación en Linux con Docker Compose

1. Copia el repositorio al servidor. Trabaja desde su raíz y crea la configuración privada.

   ```sh
   umask 077
   cp deploy/.env.example deploy/.env
   mkdir -p .nexa/private
   ```

2. Edita `deploy/.env`. Configura `APP_DOMAIN` con el nombre público, sin esquema ni ruta. Genera dos contraseñas independientes con `openssl rand -hex 32`. Usa la primera en `NEXA_OWNER_PASSWORD` y la segunda en `DATABASE_URL`, con el formato `postgresql://nexa_runtime:CONTRASEÑA@db:5432/nexatech`. Mantén `deploy/.env` con permiso 600.
3. Apunta el DNS al servidor y abre TCP 80 y 443 para Caddy antes de iniciar el servicio público. Caddy sirve React, envía `/api/` a Node.js y obtiene y renueva el certificado del dominio. PostgreSQL escucha en una red privada de Compose y su volumen se monta en `/var/lib/postgresql`. [HTTPS en Caddy](https://caddyserver.com/docs/automatic-https) · [Imagen oficial de PostgreSQL](https://hub.docker.com/_/postgres)
4. Ejecuta una de estas dos instalaciones. Con respaldo, copia el archivo a `.nexa/private/` o configura `NEXA_HANDOFF_DIR` con la ruta absoluta a tu carpeta privada.

   ```sh
   sh deploy/nexatech.sh install
   # Para instalar a partir de un respaldo en una base vacía:
   sh deploy/nexatech.sh install nexatech-demostracion.backup
   ```

5. Crea el primer administrador, comprueba la base y consulta el health check.

   ```sh
   sh deploy/nexatech.sh admin correo-administrador@example.org "Administración NexaTech"
   sh deploy/nexatech.sh verify
   curl -fsS https://tienda.example.org/api/health
   ```

`sh deploy/nexatech.sh start` y `stop` gestionan los servicios existentes. Después de actualizar el checkout al commit deseado, usa `sh deploy/nexatech.sh update` para reconstruir imágenes y aplicar las migraciones pendientes. El volumen de datos se conserva entre reinicios. Rota y respalda las credenciales de mantenimiento conforme al procedimiento de tu servidor.

## Instalación en Linux sin Docker

Usa un clúster PostgreSQL 18 dedicado o un usuario de mantenimiento autorizado para crear la base y el rol de aplicación. Limita PostgreSQL a loopback y aplica SCRAM. Configura `NEXATECH_OWNER_URL` y `DATABASE_URL` en el `.env` privado de la cuenta de mantenimiento. Las dos URL deben apuntar a la misma base con usuarios distintos.

Para una base sembrada ejecuta `npm ci`, `npm run db:init -- --seed` y `npm run build`. Para partir del archivo, conserva `npm ci` y `npm run build` y usa `npm run db:prepare` seguido de `npm run db:restore -- /ruta/privada/nexatech-demostracion.backup`. `npm run db:verify -- --demo` comprueba las 153 fichas de la carga inicial, las protecciones y la conciliación de inventario. En una base con cambios de catálogo usa `npm run db:verify`.

Ejecuta la API como un usuario de servicio sin privilegios, por ejemplo con `ExecStart=/usr/bin/node --env-file=/etc/nexatech/api.env /opt/nexatech/server/index.mjs` en systemd. El archivo de servicio solo necesita `DATABASE_URL`, `APP_ORIGIN=https://tienda.example.org`, `API_HOST=127.0.0.1`, `API_PORT=8787`, `TRUST_PROXY=1`, `NODE_ENV=production` y las variables SMTP que uses. Guarda `NEXATECH_OWNER_URL` solo para mantenimiento. Copia `dist/` a la raíz web de Caddy y configura `APP_DOMAIN`, `WEB_ROOT` y `API_UPSTREAM=127.0.0.1:8787` en el entorno del proxy antes de cargar [Caddyfile](../deploy/Caddyfile).

## Correo y recuperación

Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` y, si tu proveedor requiere autenticación, `SMTP_USER` y `SMTP_PASSWORD`. Usa 587 con STARTTLS o 465 con TLS implícito. Conserva `SMTP_REQUIRE_TLS=true` en el servidor. Prueba la recepción desde un buzón controlado. Los enlaces caducan en 30 minutos y funcionan una sola vez. Cambiar la contraseña revoca las sesiones de esa cuenta. Si el transporte falta o falla, la interfaz informa que el servicio de correo no está disponible.

## Respaldo de entrega y restauración

`npm run db:backup -- .nexa/private/nexatech-demostracion.backup` reconstruye una base con carga académica y ejecuta `pg_dump -Fc`. El equivalente con Docker es `sh deploy/nexatech.sh backup nexatech-demostracion.backup`. El archivo lleva esquema, migraciones, catálogo, inventario de apertura, envíos, cupones y políticas. Las tablas de autenticación, sesiones, clientes, direcciones, pedidos y soporte se restauran vacías. El respaldo de entrega reproduce el estado inicial de demostración. Para conservar el estado de una instalación en uso, programa y protege un respaldo operativo independiente que sí conserve las cuentas y transacciones autorizadas. [Respaldo lógico en PostgreSQL 18](https://www.postgresql.org/docs/18/backup-dump.html)

La restauración usa una base vacía, una transacción de `pg_restore` y reaplica los permisos del rol restringido. El instalador se detiene si el destino ya contiene objetos. Después ejecuta `verify`, crea el primer ADMIN y completa una compra con datos ficticios.

## Pruebas locales

`npm run lint`, `npm run build` y `npm run test:local` ejecutan las verificaciones de código, compilación, API y navegador. `NEXATECH_TEST_CHROME` y `NEXATECH_TEST_EDGE` permiten indicar los ejecutables. Para repetir el ensayo sobre el respaldo, apunta `NEXATECH_TEST_BACKUP` al archivo privado y ejecuta `npm run test:local`. Las suites crean bases sintéticas independientes en el clúster local y conservan los resultados para inspección.
