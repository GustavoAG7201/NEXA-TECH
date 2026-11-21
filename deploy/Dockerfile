FROM node:24-bookworm-slim AS node-base
WORKDIR /app
COPY package*.json ./

FROM node-base AS frontend-build
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src/ src/
COPY public/ public/
RUN npm run build

FROM node-base AS dependencies
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY server/ server/
USER node
CMD ["node", "server/index.mjs"]

FROM postgres:18-bookworm AS db-tools
WORKDIR /app
COPY --from=node-base /usr/local/bin/node /usr/local/bin/node
COPY --from=dependencies /app/node_modules ./node_modules
COPY server/ server/
COPY database/ database/
COPY scripts/database.mjs scripts/admin.mjs scripts/runtime-audit.sql scripts/
COPY dataconnect/migrations/ dataconnect/migrations/
COPY dataconnect/seed/ dataconnect/seed/
USER postgres
ENTRYPOINT ["node"]
CMD ["scripts/database.mjs", "verify"]

FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend-build /app/dist /srv/nexatech
