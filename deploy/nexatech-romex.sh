#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
umask 077
if [ ! -f deploy/.env ]; then
  echo 'Configura deploy/.env con los valores de deploy/.env.example.' >&2
  exit 1
fi
mkdir -p .nexa/private

compose() {
  docker compose --env-file deploy/.env -f deploy/compose.romex.yaml "$@"
}

tools() {
  compose run --rm --user "$(id -u):$(id -g)" db-tools "$@"
}

backup_path() {
  case "${1:-}" in
    */*|''|.*) echo 'Indica el nombre del respaldo dentro de la carpeta privada.' >&2; exit 1 ;;
    *.backup) printf '/handoff/%s\n' "$1" ;;
    *) echo 'El archivo debe terminar en .backup.' >&2; exit 1 ;;
  esac
}

case "${1:-}" in
  install)
    compose config --quiet
    compose build web api db-tools
    compose up -d --wait db
    if [ -n "${2:-}" ]; then
      archive=$(backup_path "$2")
      tools scripts/database.mjs prepare
      tools scripts/database.mjs restore "$archive"
    else
      tools scripts/database.mjs init --seed
    fi
    compose up -d --wait api web
    ;;
  start) compose up -d --wait db api web ;;
  stop) compose stop web api db ;;
  update)
    compose build web api db-tools
    compose up -d --wait db
    tools scripts/database.mjs migrate
    compose up -d --wait api web
    ;;
  verify) tools scripts/database.mjs verify ;;
  backup) tools scripts/database.mjs backup "$(backup_path "${2:-}")" ;;
  admin)
    shift
    tools scripts/admin.mjs "$@"
    ;;
  *) echo 'Usa install [archivo.backup], start, stop, update, verify, backup archivo.backup o admin correo [nombre].' >&2; exit 1 ;;
esac
