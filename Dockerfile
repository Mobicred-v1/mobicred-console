# syntax=docker/dockerfile:1
# Runtime images intentionally contain no Bun, build tools, source .env files or test fixtures.
FROM oven/bun:1.4.2 AS bun-binary
FROM node:22-bookworm-slim AS toolchain
COPY --from=bun-binary /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM toolchain AS manifests
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

FROM manifests AS dependencies
RUN bun install --frozen-lockfile

FROM dependencies AS api-build
COPY apps/api ./apps/api
RUN bun run --cwd apps/api build && test -f apps/api/dist/main.js

FROM manifests AS api-dependencies
RUN bun install --frozen-lockfile --production --filter console-api \
    && mkdir -p apps/api/node_modules

FROM dependencies AS web-build
COPY apps/web ./apps/web
RUN mkdir -p apps/web/public \
    && bun run --cwd apps/web build \
    && test -f apps/web/.next/standalone/apps/web/server.js

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production PORT=3005
WORKDIR /app/apps/api
COPY --from=api-dependencies /app/node_modules /app/node_modules
COPY --from=api-dependencies /app/apps/api/node_modules ./node_modules
COPY --from=api-build /app/apps/api/dist ./dist
COPY apps/api/package.json ./package.json
COPY deploy/runtime-config.cjs deploy/migrate.cjs deploy/start-api.cjs deploy/healthcheck.cjs /app/deploy/
USER node
EXPOSE 3005
CMD ["node", "/app/deploy/start-api.cjs"]

FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3006
WORKDIR /app
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /app/apps/web/public ./apps/web/public
COPY deploy/runtime-config.cjs deploy/start-web.cjs deploy/healthcheck.cjs /app/deploy/
USER node
EXPOSE 3006
CMD ["node", "/app/deploy/start-web.cjs"]
