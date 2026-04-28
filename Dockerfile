# ============================================
# Stage 1: Source
# ============================================
FROM scratch AS source
COPY . /app

# ============================================
# Stage 2: Dependencies
# ============================================
FROM oven/bun:1.3.9 AS deps
WORKDIR /app
ENV CI=true
ENV LEFTHOOK=0
ENV BUN_INSTALL_CACHE_DIR=/tmp/.bun-install-cache

COPY package.json bun.lock ./
COPY scripts/prepare.ts ./scripts/prepare.ts
RUN rm -rf "${BUN_INSTALL_CACHE_DIR}" \
  && mkdir -p "${BUN_INSTALL_CACHE_DIR}" \
  && bun install --frozen-lockfile --no-cache --backend=copyfile --network-concurrency=8

# ============================================
# Stage 3: Builder (Next.js)
# ============================================
FROM deps AS builder
WORKDIR /app

COPY --from=source /app ./

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN mkdir -p public && bun run build

# ============================================
# Stage 4: Worker Builder
# ============================================
FROM deps AS worker-builder
WORKDIR /app

COPY --from=source /app ./

# 编译队列 worker/scheduler 为独立可执行文件
RUN bun build ./src/lib/queue/worker.ts --compile --outfile=worker
RUN bun build ./src/lib/queue/scheduler.ts --compile --outfile=scheduler
RUN bun build ./src/lib/schema-management/schema-runner.ts --compile --outfile=schema-runner

# ============================================
# Stage 5: Migration Builder
# ============================================
FROM oven/bun:1.3.9 AS migrate-deps
WORKDIR /migrate
ENV BUN_INSTALL_CACHE_DIR=/tmp/.bun-install-cache

RUN cat <<'EOF' > package.json
{
  "name": "juanie-migrate",
  "private": true,
  "type": "module",
  "dependencies": {
    "postgres": "3.4.8"
  }
}
EOF

RUN rm -rf "${BUN_INSTALL_CACHE_DIR}" \
  && mkdir -p "${BUN_INSTALL_CACHE_DIR}" \
  && bun install --production --no-cache --backend=copyfile --network-concurrency=8

# ============================================
# Stage 6: Web Runner
# ============================================
FROM node:20-bookworm-slim AS web
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# 复制 Next.js standalone
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/static
COPY --from=builder --chown=1001:1001 /app/public ./public
RUN mkdir -p ./.next/cache && chown -R 1001:1001 ./.next/cache

EXPOSE 3001

CMD ["node", "server.js"]

# ============================================
# Stage 7: Worker Runner
# ============================================
FROM oven/bun:1.3.9 AS worker
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache

ARG TARGETOS=linux
ARG TARGETARCH=amd64
ARG ATLAS_VERSION=1.1.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates bash \
  && curl -sSfL "https://atlasbinaries.com/atlas/atlas-${TARGETOS}-${TARGETARCH}-v${ATLAS_VERSION}" -o /usr/local/bin/atlas \
  && chmod +x /usr/local/bin/atlas \
  && atlas version \
  && rm -rf /var/lib/apt/lists/*

COPY --from=worker-builder /app/worker ./worker
COPY --from=worker-builder /app/scheduler ./scheduler
COPY --from=worker-builder /app/schema-runner ./schema-runner
COPY --from=source /app/templates ./templates
COPY --from=source /app/migrations ./migrations
COPY --from=migrate-deps /migrate/package.json ./package.json
COPY --from=migrate-deps /migrate/node_modules ./node_modules
RUN mkdir -p ./src/lib/releases
COPY --from=source /app/src/lib/releases/recap-record.ts ./src/lib/releases/recap-record.ts

RUN mkdir -p /tmp/.cache
RUN chmod +x ./worker
RUN chmod +x ./scheduler
RUN chmod +x ./schema-runner

CMD ["./worker"]

# ============================================
# Stage 8: Schema Runner
# ============================================
FROM worker AS schema-runner

CMD ["./schema-runner"]
