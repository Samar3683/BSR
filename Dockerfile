# syntax=docker/dockerfile:1
#
# BSR web app. Two images, both built by compose.yaml (profile "app"):
#   runner   the Next.js standalone server (node server.js, port 3000)
#   migrate  applies prisma/migrations to DATABASE_ADMIN_URL, then exits
# No secrets are baked in: DATABASE_URL, SESSION_SECRET etc. are read at run time.

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma's schema engine (migrations) links against OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------ dependencies
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`.
RUN npm ci --no-audit --no-fund

# ------------------------------------------------------------------ migrations
# Only the Prisma CLI, in the version package.json pins, and the migrations.
FROM base AS migrate
COPY package.json /tmp/package.json
RUN PRISMA_VERSION="$(node -p "require('/tmp/package.json').devDependencies.prisma")" \
  && npm install --no-save --no-package-lock --no-audit --no-fund "prisma@${PRISMA_VERSION}" \
  && rm /tmp/package.json
COPY prisma.config.ts ./
COPY prisma ./prisma
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# ------------------------------------------------------------------ build
FROM deps AS builder
COPY . .
ENV BUILD_STANDALONE=1
RUN npx prisma generate && npm run build

# ------------------------------------------------------------------ runtime
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/admin/login').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
