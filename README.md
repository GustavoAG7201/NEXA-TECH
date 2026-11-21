# NexaTech

Tienda académica con React, API Node.js y PostgreSQL 18. Las compras, envíos y reembolsos son simulados.

Con Node.js 24 o posterior y los binarios de PostgreSQL 18 disponibles en `PATH` o en `NEXATECH_PG_BIN`, ejecuta:

```sh
npm ci
npm run local:setup
npm run dev
```

Abre <http://127.0.0.1:5173>. En PowerShell puede usarse `npm.cmd`. El instalador conserva el clúster en `.nexa/local/pgdata` y guarda la configuración privada en `.env`. Para montar la API, configurar SMTP, crear al primer administrador o restaurar un respaldo, sigue la [guía de instalación](docs/INSTALACION_SERVIDOR_EXTERNO.md).

Las migraciones y semillas originales siguen en `dataconnect/migrations` y `dataconnect/seed`. El resto de SQL Connect y las guías de fases anteriores quedan como referencia histórica.
