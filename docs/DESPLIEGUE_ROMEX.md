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
- Una copia autorizada del repositorio y, si se usará la carga académica, `nexatech-demostracion.backup`.

No ejecutar `deploy/compose.yaml` en este servidor: esa variante publica 80 y 443 directamente para una instalación autónoma y competiría con Traefik.

## Preparar el checkout

Clona el repositorio en la carpeta de aplicaciones y entra a su raíz:

```sh
git clone https://github.com/GustavoAG7201/NEXA-TECH.git /srv/romex/apps/nexatech
cd /srv/romex/apps/nexatech
```

Actualiza la copia cuando haya un commit aprobado:

```sh
git fetch origin
git pull --ff-only origin main
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
cp /ruta/privada/nexatech-demostracion.backup .nexa/private/
chmod 600 .nexa/private/nexatech-demostracion.backup
```

SMTP es opcional para la primera puesta en marcha. Para recuperación de contraseñas configura además `SMTP_HOST`, `SMTP_FROM`, `SMTP_USER` y `SMTP_PASSWORD` en `deploy/.env`.

## Instalar con la demostración académica

La instalación construye React, API y herramientas de mantenimiento; levanta PostgreSQL 18 privado; restaura el respaldo; verifica restricciones, índices, disparadores e inventario; y finalmente inicia API y web.

```sh
sh deploy/nexatech-romex.sh install nexatech-demostracion.backup
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
```

El health check debe devolver `{"status":"ok"}`. La interfaz y la API usan el mismo dominio: Caddy entrega React y reenvía `/api/` al contenedor Node, mientras Traefik conserva TLS y Cloudflare expone el hostname.

## Operación posterior

Crear el primer administrador requiere una dirección de correo que el operador controle:

```sh
sh deploy/nexatech-romex.sh admin correo@ejemplo.com "Administración NexaTech"
```

Actualizar a un commit ya revisado:

```sh
git pull --ff-only origin main
sh deploy/nexatech-romex.sh update
sh deploy/nexatech-romex.sh verify
```

Crear un respaldo de demostración reproducible:

```sh
sh deploy/nexatech-romex.sh backup nexatech-demostracion.backup
```

El respaldo generado queda en `.nexa/private/`. Un respaldo operativo de producción debe planificarse por separado para conservar las cuentas y transacciones reales autorizadas.

## Diagnóstico seguro

- Si el hostname responde 502, primero verifica Traefik y el Cloudflare Tunnel existentes; no publiques puertos del contenedor ni levantes un segundo proxy.
- Si Docker no puede descargar una imagen, confirma la resolución DNS y vuelve a intentar antes de modificar la configuración global de Docker o de red.
- Los servicios se consultan con `docker compose --env-file deploy/.env -f deploy/compose.romex.yaml logs -f api web db`.
- La base no debe tener `ports:`. Accede a ella solo mediante `db-tools` o desde la red interna de Compose.

## Decisión de autenticación

La implementación autónoma incluida en este repositorio usa sus propias tablas de identidad, sesiones y recuperación de contraseña en PostgreSQL. No depende de Firebase Authentication ni de Firebase SQL Connect. Antes de mezclarla con una integración Firebase previa, decide cuál será la fuente de identidad; no actives las dos para la misma cuenta sin una migración explícita.
