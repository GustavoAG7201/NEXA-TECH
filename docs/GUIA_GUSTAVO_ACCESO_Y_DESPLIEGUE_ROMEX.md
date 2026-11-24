# Guía completa para acceder y desplegar NexaTech en Romex

Esta guía está escrita para Gustavo y explica el proceso completo desde una computadora con Windows o Ubuntu/Linux: instalar Tailscale, entrar al servidor por SSH, navegar a NexaTech, subir un respaldo, actualizar el código y verificar la publicación.

> **Importante:** esta guía no contiene contraseñas, tokens ni llaves privadas. El acceso se autoriza con la cuenta de Tailscale invitada por el administrador de Romex. Nunca pegues secretos en GitHub, WhatsApp, capturas de pantalla ni archivos versionados.

> **Estado actual:** NexaTech ya está instalado en Romex. Para el trabajo cotidiano usa las secciones **5 a 9**, **12** y **14**. La sección **11** es únicamente para reconstruir una instalación nueva con autorización del administrador; no debe ejecutarse sobre la base actual.

## 1. Datos que debes conocer

| Dato | Valor |
| --- | --- |
| Servidor | `romex` |
| IP privada de Tailscale | `100.68.200.41` |
| Usuario SSH | `carlos` |
| Contraseña SSH | No se publica ni se necesita con Tailscale SSH |
| Carpeta de NexaTech | `/srv/romex/apps/nexatech` |
| Rama de despliegue | `deploy/romex` |
| Sitio público | `https://nextech.romex.it.com` |
| Compose de Romex | `deploy/compose.romex.yaml` |
| Script operativo | `deploy/nexatech-romex.sh` |

La arquitectura desplegada es:

```text
Internet
  ↓
Cloudflare Tunnel
  ↓
Traefik del servidor Romex
  ↓
Caddy de NexaTech ── /api/* ──→ API Node.js
  ↓                              ↓
Frontend React                 PostgreSQL 18 privado
```

Frontend y API usan el mismo dominio. PostgreSQL no publica su puerto hacia Internet.

## 2. Solicitar acceso antes de comenzar

El administrador de Romex debe invitar tu correo a la red privada de Tailscale y autorizar SSH hacia el servidor `romex` como usuario `carlos`.

Necesitas:

1. Una invitación a la red Tailscale de Romex.
2. Permiso para acceder al dispositivo `romex`.
3. Permiso SSH para usar el usuario Linux `carlos`.
4. Acceso de lectura/escritura al repositorio `GustavoAG7201/NEXA-TECH`.

Si Tailscale muestra el servidor pero SSH responde `Permission denied`, no pruebes contraseñas: solicita al administrador que revise la política de acceso.

## 3. Instalar Tailscale

Sigue solamente la subsección de tu sistema operativo.

### 3.1. Windows

Tailscale requiere Windows 10 o posterior.

1. Abre la descarga oficial: <https://tailscale.com/download/windows>.
2. Descarga y ejecuta el instalador `.exe`.
3. Al terminar, busca el icono de Tailscale en la bandeja del sistema, junto al reloj.
4. Pulsa **Log in** o **Iniciar sesión**.
5. Usa exactamente el correo que fue invitado a la red Romex.
6. Acepta la invitación si Tailscale la muestra.
7. Confirma que el estado sea **Connected**.

Documentación oficial: [Instalar Tailscale en Windows](https://tailscale.com/docs/install/windows).

### 3.2. Ubuntu, Debian y distribuciones derivadas

Abre una terminal y ejecuta el instalador oficial:

```sh
curl -fsSL https://tailscale.com/install.sh | sh
```

Después inicia la conexión:

```sh
sudo tailscale up
```

El comando mostrará un enlace. Ábrelo en el navegador e inicia sesión con el correo invitado a la red Romex. No uses una cuenta distinta aunque ya tengas otra cuenta de Tailscale.

Documentación oficial: [Instalar Tailscale en Linux](https://tailscale.com/docs/install/linux).

### 3.3. Verificar la conexión

En PowerShell (Windows) o en la terminal (Linux), ejecuta:

```powershell
tailscale status
```

Debes encontrar un equipo llamado `romex` o la dirección `100.68.200.41`.

También puedes comprobar conectividad:

```powershell
tailscale ping 100.68.200.41
```

Si Windows no reconoce el comando `tailscale`, verifica el estado desde el icono de Tailscale y vuelve a abrir PowerShell. En Linux, confirma primero que la instalación terminó correctamente y ejecuta `sudo systemctl status tailscaled`.

## 4. Verificar el cliente SSH

En PowerShell (Windows) o en la terminal (Linux) ejecuta:

```powershell
ssh -V
```

Si aparece una versión de OpenSSH, ya está listo.

En Ubuntu/Linux, OpenSSH normalmente ya está instalado. Si la terminal indica que `ssh` no existe:

```sh
sudo apt update
sudo apt install openssh-client
```

En Windows, si indica que `ssh` no existe:

1. Abre **Configuración**.
2. Entra a **Sistema → Características opcionales**.
3. Busca **Cliente OpenSSH**.
4. Instálalo y vuelve a abrir PowerShell.

También puede instalarse desde PowerShell como administrador:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

Referencia oficial: [Instalar OpenSSH en Windows](https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse).

## 5. Conectarse al servidor por SSH

Con Tailscale conectado, abre PowerShell (Windows) o una terminal (Linux) y ejecuta:

```powershell
ssh carlos@100.68.200.41
```

La primera vez, SSH puede mostrar la huella del servidor y preguntar:

```text
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Confirma la huella con el administrador de Romex y escribe:

```text
yes
```

Tailscale puede exigir una comprobación adicional y mostrar un enlace parecido a:

```text
Tailscale SSH requires an additional check.
To authenticate, visit: https://login.tailscale.com/a/...
```

Abre ese enlace, autoriza la sesión y repite:

```powershell
ssh carlos@100.68.200.41
```

No escribas ni solicites la contraseña del usuario `carlos`. Tailscale SSH valida la identidad y el permiso mediante la cuenta autorizada. Consulta [Tailscale SSH](https://tailscale.com/docs/features/tailscale-ssh).

### Confirmar que entraste al servidor correcto

Ya dentro del servidor, ejecuta:

```sh
whoami
hostname
pwd
```

La salida esperada incluye:

```text
carlos
romex
```

Para salir del servidor:

```sh
exit
```

Cuando el indicador de la terminal se parece a `carlos@romex:~$`, los comandos se ejecutan en el servidor. Cuando vuelves a ver `PS C:\Users\Gustavo>` o el indicador habitual de tu computadora, ya estás en tu equipo local. Comprueba esto antes de copiar archivos o ejecutar Docker.

## 6. Conectarse desde Visual Studio Code (opcional)

1. Instala Visual Studio Code.
2. Instala la extensión oficial **Remote - SSH**.
3. Pulsa `Ctrl+Shift+P`.
4. Ejecuta **Remote-SSH: Add New SSH Host**.
5. Escribe:

   ```text
   ssh carlos@100.68.200.41
   ```

6. Guarda la configuración en tu archivo SSH de usuario.
7. Ejecuta **Remote-SSH: Connect to Host** y selecciona el servidor.

La entrada equivalente en `C:\Users\TU_USUARIO\.ssh\config` es:

```sshconfig
Host romex-nexatech
    HostName 100.68.200.41
    User carlos
```

Después puedes conectarte desde PowerShell usando:

```powershell
ssh romex-nexatech
```

## 7. Entrar a la carpeta de NexaTech

Después de iniciar SSH:

```sh
cd /srv/romex/apps/nexatech
pwd
ls -la
```

`pwd` debe mostrar:

```text
/srv/romex/apps/nexatech
```

### Carpetas y archivos importantes

| Ruta | Contenido |
| --- | --- |
| `src/` | Frontend React |
| `server/` | API Node.js |
| `database/` | Esquema y migraciones de PostgreSQL |
| `public/` | Imágenes y recursos públicos |
| `deploy/compose.romex.yaml` | Servicios Docker para Romex |
| `deploy/nexatech-romex.sh` | Comandos de instalación y actualización |
| `deploy/.env` | Secretos y configuración privada; no abrir ni copiar sin necesidad |
| `.nexa/private/` | Respaldos privados; nunca se suben a GitHub |

No trabajes desde `/`, `/srv/romex` ni la carpeta de otra aplicación. Comprueba siempre `pwd` antes de ejecutar comandos Docker.

### Comandos básicos para moverse

| Comando | Qué hace |
| --- | --- |
| `pwd` | Muestra en qué carpeta estás |
| `ls -la` | Lista archivos, incluidos los ocultos |
| `cd /ruta/completa` | Entra a una carpeta concreta |
| `cd ..` | Sube una carpeta |
| `cd` | Regresa a la carpeta personal del usuario |
| `clear` | Limpia la pantalla sin borrar archivos |
| `Ctrl+C` | Detiene el comando que está ocupando la terminal |
| `exit` | Cierra la sesión SSH |

Linux distingue mayúsculas y minúsculas: `NexaTech` y `nexatech` serían nombres diferentes. No uses `sudo` por costumbre; para esta aplicación normalmente no es necesario.

## 8. Revisar el estado sin modificar nada

Desde `/srv/romex/apps/nexatech`:

```sh
docker compose --env-file deploy/.env -f deploy/compose.romex.yaml ps
```

Los servicios `db`, `api` y `web` deben aparecer como `healthy`.

Ver los últimos registros sin modificar los servicios:

```sh
docker compose --env-file deploy/.env -f deploy/compose.romex.yaml logs --tail=100 api web db
```

Seguir registros en tiempo real:

```sh
docker compose --env-file deploy/.env -f deploy/compose.romex.yaml logs -f api web
```

Pulsa `Ctrl+C` para dejar de seguirlos; los contenedores continúan ejecutándose.

## 9. Trabajar con GitHub

La rama aprobada para el servidor es:

```text
deploy/romex
```

Haz los cambios de código en tu computadora, confírmalos en Git y súbelos a GitHub. El servidor debe recibir commits revisados; no conviene usarlo como editor principal ni modificar archivos de producción a mano.

### Comprobar si la carpeta actual es un checkout de Git

```sh
cd /srv/romex/apps/nexatech
if [ -d .git ]; then echo "Git disponible"; else echo "Esta copia no tiene .git"; fi
```

Si muestra `Esta copia no tiene .git`, **no ejecutes `git init`, no borres la carpeta y no clones encima**. Esa instalación puede haber sido sincronizada desde otra estación. Pide al administrador de Romex que vincule la carpeta al repositorio o que sincronice el commit aprobado.

Si muestra `Git disponible`, revisa antes de actualizar:

```sh
git status --short --branch
git remote -v
git fetch origin
git log --oneline --decorate -5 origin/deploy/romex
```

No continúes si `git status` muestra cambios locales que no reconoces. No uses `git reset --hard`, `git clean`, `git checkout --` ni `git push --force`.

### Clonación inicial en un servidor vacío

Solo para una instalación nueva y con autorización del administrador:

```sh
cd /srv/romex/apps
git clone --branch deploy/romex --single-branch https://github.com/GustavoAG7201/NEXA-TECH.git nexatech
cd nexatech
```

Si GitHub solicita credenciales porque el repositorio es privado, no uses la contraseña de GitHub ni pegues un token en la URL. Solicita al administrador un deploy key de solo lectura o configura acceso SSH de GitHub de manera separada.

## 10. Subir un respaldo desde tu computadora

El respaldo debe ser un archivo PostgreSQL con extensión `.backup`. Ejecuta `scp` en tu computadora, no dentro de la sesión SSH.

En PowerShell de Windows:

```powershell
scp "C:\Users\Gustavo\Downloads\nexatech-romex-entrega.backup" carlos@100.68.200.41:/srv/romex/apps/nexatech/.nexa/private/nexatech-romex-entrega.backup
```

Ajusta la ruta local según donde esté el archivo. Las comillas son obligatorias cuando el nombre contiene espacios o paréntesis.

En Ubuntu/Linux, por ejemplo:

```sh
scp "$HOME/Descargas/nexatech-romex-entrega.backup" carlos@100.68.200.41:/srv/romex/apps/nexatech/.nexa/private/nexatech-romex-entrega.backup
```

Después entra por SSH y protege el archivo:

```sh
cd /srv/romex/apps/nexatech
chmod 600 .nexa/private/nexatech-romex-entrega.backup
ls -lh .nexa/private/nexatech-romex-entrega.backup
```

No guardes el respaldo dentro de `public/`, `src/`, `deploy/` ni el repositorio Git.

## 11. Instalación inicial

Esta sección es únicamente para una base nueva. No ejecutes `install` sobre una instalación que ya tiene datos.

### Crear configuración privada

```sh
cd /srv/romex/apps/nexatech
umask 077
mkdir -p .nexa/private
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
```

Genera dos contraseñas distintas:

```sh
openssl rand -hex 32
openssl rand -hex 32
```

No copies esas contraseñas en chats o capturas. Edita el archivo:

```sh
nano deploy/.env
```

Configura, como mínimo:

```dotenv
APP_DOMAIN=nextech.romex.it.com
NEXA_OWNER_PASSWORD=<contraseña_aleatoria_del_dueño>
DATABASE_URL=postgresql://nexa_runtime:<contraseña_aleatoria_del_runtime>@db:5432/nexatech
SMTP_PORT=587
SMTP_REQUIRE_TLS=true
```

En `nano`:

- `Ctrl+O`, `Enter`: guardar.
- `Ctrl+X`: salir.

Valida sin mostrar los secretos:

```sh
docker compose --env-file deploy/.env -f deploy/compose.romex.yaml config --quiet
```

### Instalar usando el respaldo de entrega

```sh
sh deploy/nexatech-romex.sh install nexatech-romex-entrega.backup
```

El proceso construye frontend y API, crea PostgreSQL 18, restaura el respaldo, valida el inventario y arranca los servicios.

## 12. Actualizar una instalación existente

No vuelvas a ejecutar `install`. El flujo normal es:

1. Subir los cambios a `deploy/romex` desde tu computadora.
2. Confirmar que el commit fue revisado.
3. Actualizar el checkout del servidor, si la carpeta tiene `.git`:

   ```sh
   cd /srv/romex/apps/nexatech
   git switch deploy/romex
   git pull --ff-only origin deploy/romex
   ```

4. Ejecutar la actualización:

   ```sh
   sh deploy/nexatech-romex.sh update
   ```

5. Verificar:

   ```sh
   sh deploy/nexatech-romex.sh verify
   docker compose --env-file deploy/.env -f deploy/compose.romex.yaml ps
   ```

`update` reconstruye las imágenes, aplica únicamente las migraciones pendientes y conserva el volumen de PostgreSQL.

Si la carpeta no tiene `.git`, detente después del paso 2 y solicita la sincronización del código al administrador. No copies archivos manualmente encima de una aplicación activa sin respaldo.

## 13. Cambiar el subdominio

Cambiar el hostname requiere dos acciones coordinadas:

1. En Cloudflare, crear o editar la aplicación publicada para que apunte a:

   ```text
   https://localhost:443
   ```

2. En el servidor, editar únicamente `APP_DOMAIN` en `deploy/.env`:

   ```sh
   nano deploy/.env
   ```

   Ejemplo:

   ```dotenv
   APP_DOMAIN=nextech.romex.it.com
   ```

3. Aplicar la configuración:

   ```sh
   sh deploy/nexatech-romex.sh update
   ```

4. Verificar la URL nueva antes de retirar la anterior.

No agregues `http://` ni `https://` dentro de `APP_DOMAIN`.

## 14. Verificación final

Desde el servidor:

```sh
cd /srv/romex/apps/nexatech
sh deploy/nexatech-romex.sh verify
docker compose --env-file deploy/.env -f deploy/compose.romex.yaml ps
```

Desde PowerShell o cualquier equipo con Internet:

```powershell
curl.exe -fsS https://nextech.romex.it.com/api/health
curl.exe -fsS https://nextech.romex.it.com/api/legal-contact
curl.exe -I https://nextech.romex.it.com/catalogo/modelos/novabook-air-14.webp
```

Resultados esperados:

- `/api/health` devuelve `{"status":"ok"}`.
- `/api/legal-contact` devuelve la configuración pública autorizada.
- La imagen devuelve `HTTP 200` y `Content-Type: image/webp`.
- La página <https://nextech.romex.it.com/> abre el catálogo.

Antes de presentar al profesor, prueba también:

1. Registro e inicio de sesión.
2. Catálogo, filtros e imágenes.
3. Carrito y cotización.
4. Compra simulada y comprobante.
5. Consulta de pedidos.
6. Acceso administrativo con una cuenta autorizada.
7. Cancelación, devolución o soporte.

## 15. Comandos operativos seguros

Iniciar servicios existentes:

```sh
sh deploy/nexatech-romex.sh start
```

Detener NexaTech sin borrar datos:

```sh
sh deploy/nexatech-romex.sh stop
```

Verificar base y permisos:

```sh
sh deploy/nexatech-romex.sh verify
```

Crear al primer administrador:

```sh
sh deploy/nexatech-romex.sh admin correo-controlado@ejemplo.com "Administración NexaTech"
```

Configura un correo que Gustavo controle y sigue la solicitud interactiva de contraseña. No escribas esa contraseña en la documentación.

## 16. Comandos que NO debes ejecutar

No ejecutes estos comandos sin acompañamiento del administrador:

```text
docker compose down -v
docker volume rm ...
docker system prune -a
rm -rf /srv/romex
git reset --hard
git clean -fd
git push --force
```

Pueden borrar la base, imágenes compartidas, código u otros despliegues del servidor.

Tampoco debes:

- Editar Traefik global.
- Reiniciar Docker o Cloudflare Tunnel.
- Publicar PostgreSQL con `ports:`.
- Ejecutar `deploy/compose.yaml` en Romex; ese archivo intenta usar directamente los puertos 80 y 443. Usa `deploy/compose.romex.yaml`.
- Tocar carpetas de otras aplicaciones bajo `/srv/romex/apps/`.
- Mostrar `deploy/.env` en una captura o copiarlo fuera del servidor.

## 17. Solución de problemas

### Tailscale pide una comprobación adicional

Abre el enlace que muestra SSH, autoriza la sesión en el navegador y repite el comando.

### SSH muestra `Permission denied`

Confirma que Tailscale está conectado con el correo invitado. Si continúa, el administrador debe revisar la política SSH de la tailnet.

### `git pull` pide credenciales

El repositorio es privado o el servidor no tiene un deploy key. No pegues tokens en la URL. Solicita acceso de solo lectura para el servidor.

### `git pull` dice que hay cambios locales

No los descartes. Ejecuta:

```sh
git status --short --branch
```

Envía la salida al administrador para revisar los archivos.

### El dominio devuelve 404

Comprueba que `APP_DOMAIN` coincide exactamente con el hostname configurado en Cloudflare y que el contenedor `web` está saludable.

### El dominio devuelve 502

Comprueba servicios y registros. Un 502 suele indicar que Cloudflare o Traefik no pueden alcanzar el contenedor web:

```sh
docker compose --env-file deploy/.env -f deploy/compose.romex.yaml ps
docker compose --env-file deploy/.env -f deploy/compose.romex.yaml logs --tail=100 web api
```

### La API devuelve 503

Revisa `db` y `api`:

```sh
docker compose --env-file deploy/.env -f deploy/compose.romex.yaml logs --tail=100 db api
```

No recrees ni borres el volumen de PostgreSQL como primer intento.

## 18. Resumen rápido para una actualización normal

```powershell
# En Windows
ssh carlos@100.68.200.41
```

```sh
# En el servidor
cd /srv/romex/apps/nexatech
pwd
if [ -d .git ]; then
  git status --short --branch
  git switch deploy/romex
  git pull --ff-only origin deploy/romex
  sh deploy/nexatech-romex.sh update
  sh deploy/nexatech-romex.sh verify
  docker compose --env-file deploy/.env -f deploy/compose.romex.yaml ps
else
  echo "DETENTE: esta copia no tiene .git; solicita la sincronización al administrador"
fi
```

Finalmente abre:

<https://nextech.romex.it.com/>

## Referencias oficiales

- [Descargar Tailscale para Windows](https://tailscale.com/download/windows)
- [Instalar Tailscale en Windows](https://tailscale.com/docs/install/windows)
- [Descargar Tailscale para Linux](https://tailscale.com/download/linux)
- [Instalar Tailscale en Linux](https://tailscale.com/docs/install/linux)
- [Tailscale SSH](https://tailscale.com/docs/features/tailscale-ssh)
- [Conectarse a dispositivos con Tailscale](https://tailscale.com/docs/how-to/connect-to-devices)
- [Instalar OpenSSH en Windows](https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse)
