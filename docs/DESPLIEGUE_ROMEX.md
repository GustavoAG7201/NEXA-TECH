# Despliegue de NexaTech en infraestructura Romex

Esta guía instala NexaTech como una aplicación compuesta en el servidor Romex. La tienda usa un solo hostname público, pero separa sus responsabilidades en tres contenedores:

```text
Internet → Cloudflare Tunnel → Traefik → Caddy (React y /api) → API Node → PostgreSQL 18
```

El navegador abre la interfaz y la API por el mismo origen. PostgreSQL no publica puertos y solo existe dentro de la red privada de Docker.

## Requisitos de infraestructura

- Docker Compose v2.
- Red externa de Docker llamada `traefik`.
- Traefik atendiendo los entrypoints `web` (80) y `websecure` (443).
- Cloudflare Tunnel ya conectado al servidor y un hostname publicado hacia `https://localhost:443`, con la verificación TLS de origen configurada como en las demás aplicaciones Romex.
- Una copia autorizada de `deploy/romex`. Para restaurar la entrega, usa `nexatech-romex-entrega.backup`, que contiene el catálogo y la configuración inicial.

No ejecutar `deploy/compose.yaml` en este servidor: esa variante publica 80 y 443 directamente para una instalación autónoma y competiría con Traefik.

## Preparar el checkout

Clona el repositorio en la carpeta de aplicaciones y entra a su raíz:

```sh
git clone --branch deploy/romex --single-branch https://github.com/GustavoAG7201/NEXA-TECH.git /srv/romex/apps/nexatech
cd /srv/romex/apps/nexatech
```

Actualiza la copia cuando haya un commit aprobado:

```sh
git switch deploy/romex
git pull --ff-only origin deploy/romex
```

## Configuración privada

Nunca versionar `deploy/.env` ni respaldos. Crea las carpetas y genera contraseñas distintas para el dueño de la base y el rol de ejecución:

```sh
umask 077
mkdir -p .nexa/private
cp deploy/.env.example deploy/.env
owner_password=$(openssl rand -hex 32)
runtime_password=$(openssl rand -hex 32)
```

Edita `deploy/.env` con valores equivalentes a estos, sin comillas ni espacios finales:

```dotenv
APP_DOMAIN=tarea-gustambo.romex.it.com
NEXA_OWNER_PASSWORD=<owner_password>
DATABASE_URL=postgresql://nexa_runtime:<runtime_password>@db:5432/nexatech
SMTP_PORT=587
SMTP_REQUIRE_TLS=true
```

Restringe los permisos y, si se restaurará la demostración, coloca el archivo en la carpeta privada:

```sh
chmod 600 deploy/.env
cp /ruta/privada/nexatech-romex-entrega.backup .nexa/private/
chmod 600 .nexa/private/nexatech-romex-entrega.backup
```

SMTP es opcional para la primera puesta en marcha. Para recuperación de contraseñas configura además `SMTP_HOST`, `SMTP_FROM`, `SMTP_USER` y `SMTP_PASSWORD` en `deploy/.env`.

Configura `LEGAL_RESPONSIBLE`, `LEGAL_ADDRESS`, `LEGAL_PRIVACY_EMAIL`, `LEGAL_SUPPORT_EMAIL` y `LEGAL_SUPPORT_PHONE` únicamente con los datos públicos aprobados por la administración. Las políticas muestran los datos faltantes como pendientes de validación administrativa. Completa esta validación antes de abrir el registro de cuentas al público.

## Instalar con el respaldo de entrega

La instalación construye React, API y herramientas de mantenimiento; levanta PostgreSQL 18 privado; restaura el respaldo; verifica restricciones, índices, disparadores e inventario; y finalmente inicia API y web.

```sh
sh deploy/nexatech-romex.sh install nexatech-romex-entrega.backup
```

Para una instalación limpia con las semillas versionadas en el repositorio, omite el nombre del respaldo:

```sh
sh deploy/nexatech-romex.sh install
```

No repitas `install` sobre una base existente. Para actualizar una instalación ya creada, usa `update`.

## Verificar la publicación

Comprueba servicios, integridad de base y endpoints desde el servidor o una red externa:

```sh
docker compose --env-file deploy/.env -f deploy/compose.romex.yaml ps
sh deploy/nexatech-romex.sh verify
curl -fsS https://tarea-gustambo.romex.it.com/api/health
curl -fsS https://tarea-gustambo.romex.it.com/
curl -fsSI https://tarea-gustambo.romex.it.com/catalogo/modelos/novabook-air-14.webp
```

El health check debe devolver `{"status":"ok"}`. La interfaz y la API usan el mismo dominio: Caddy entrega React y reenvía `/api/` al contenedor Node, mientras Traefik conserva TLS y Cloudflare expone el hostname.

## Operación posterior

Crear el primer administrador requiere una dirección de correo que el operador controle:

```sh
sh deploy/nexatech-romex.sh admin correo@ejemplo.com "Administración NexaTech"
```

Actualizar a un commit ya revisado:

```sh
git switch deploy/romex
git pull --ff-only origin deploy/romex
sh deploy/nexatech-romex.sh update
sh deploy/nexatech-romex.sh verify
```

Crear un respaldo de entrega reproducible:

```sh
sh deploy/nexatech-romex.sh backup nexatech-romex-entrega.backup
```

El respaldo generado queda en `.nexa/private/`. Usa una base temporal con las semillas del repositorio y excluye cuentas, sesiones, direcciones y pedidos. En local, el comando equivalente es `npm run db:backup -- .nexa/private/nexatech-romex-entrega.backup` con PostgreSQL en ejecución. Para conservar cuentas o transacciones de una instalación existente, usa el procedimiento de respaldo operativo del servidor.

## Presentación local

```sh
npm ci
npm run local:setup
npm run dev
```

Abre `http://127.0.0.1:5173`. Ejecuta `npm run local:start` antes de `npm run dev` si ya instalaste el clúster local y está detenido. La publicación requiere que el administrador valide los datos legales, configure los secretos y el hostname de Cloudflare, y ejecute la instalación y los comandos de verificación anteriores.

## Diagnóstico seguro

- Si el hostname responde 502, primero verifica Traefik y el Cloudflare Tunnel existentes; no publiques puertos del contenedor ni levantes un segundo proxy.
- Si Docker no puede descargar una imagen, confirma la resolución DNS y vuelve a intentar antes de modificar la configuración global de Docker o de red.
- Los servicios se consultan con `docker compose --env-file deploy/.env -f deploy/compose.romex.yaml logs -f api web db`.
- La base no debe tener `ports:`. Accede a ella solo mediante `db-tools` o desde la red interna de Compose.

## Referencias de las políticas

- [Ley Federal de Protección al Consumidor](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf).
- [Ley Federal de Protección de Datos Personales en Posesión de los Particulares](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf).
- [Orientación y reclamaciones de Profeco](https://profeco.gob.mx/Concilianet/faq.jsp).
