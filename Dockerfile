# ============================================
# Stage 1: Source
# ============================================
FROM scratch AS source
COPY . /app

# ============================================
# Stage 2: Security-refreshed Final Bases
# ============================================
FROM oven/bun:1.3.9@sha256:856da45d07aeb62eb38ea3e7f9e1794c0143a4ff63efb00e6c4491b627e2a521 AS bun-runtime-os
ARG SECURITY_REFRESH=manual
RUN echo "security-refresh=${SECURITY_REFRESH}" >/dev/null \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y \
  && rm -rf /var/lib/apt/lists/*

# ============================================
# Stage 3: Dependencies
# ============================================
FROM oven/bun:1.3.9@sha256:856da45d07aeb62eb38ea3e7f9e1794c0143a4ff63efb00e6c4491b627e2a521 AS deps
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
# Stage 4: Builder (Next.js)
# ============================================
FROM deps AS builder
WORKDIR /app

COPY --from=source /app ./

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN mkdir -p public && bun run build

# ============================================
# Stage 5: Worker Builder
# ============================================
FROM deps AS worker-builder
WORKDIR /app

COPY --from=source /app ./

# 编译队列 worker/scheduler 为独立可执行文件
RUN bun build ./src/lib/queue/worker.ts --compile --outfile=worker
RUN bun build ./src/lib/queue/scheduler.ts --compile --outfile=scheduler
RUN bun build ./src/lib/schema-management/schema-runner.ts --compile --outfile=schema-runner
RUN bun build ./src/lib/restate/server.ts --compile --outfile=restate-services
RUN bun build ./src/lib/outbox/dispatcher.ts --compile --outfile=outbox-dispatcher
RUN bun build ./src/lib/backups/control-plane-uploader.ts --compile --outfile=control-plane-backup-uploader
RUN bun build ./src/lib/backups/restate-snapshot.ts --compile --outfile=restate-snapshot

# ============================================
# Stage 6: Verified Atlas Distribution
# ============================================
FROM oven/bun:1.3.9@sha256:856da45d07aeb62eb38ea3e7f9e1794c0143a4ff63efb00e6c4491b627e2a521 AS atlas-distribution

ARG TARGETARCH=amd64
ARG ATLAS_VERSION=1.2.3
ARG ATLAS_SHA256_AMD64=241d8c56091c58c7bea71c028bdee66b998f8225aaf60fee954914dbb9bed430
ARG ATLAS_SHA256_ARM64=4e81e18e1ce554cf1e177bb462f887dad31aaf00471d0e4bbba84fedf155fed1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN case "${TARGETARCH}" in \
      amd64) atlas_sha256="${ATLAS_SHA256_AMD64}" ;; \
      arm64) atlas_sha256="${ATLAS_SHA256_ARM64}" ;; \
      *) echo "Unsupported Atlas architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
  && curl --fail --location --retry 5 --retry-all-errors \
      "https://release.ariga.io/atlas/atlas-linux-${TARGETARCH}-v${ATLAS_VERSION}" \
      --output /tmp/atlas \
  && echo "${atlas_sha256}  /tmp/atlas" | sha256sum -c - \
  && install -m 0755 /tmp/atlas /usr/local/bin/atlas \
  && rm /tmp/atlas \
  && /usr/local/bin/atlas version \
  && /usr/local/bin/atlas migrate apply --help | grep -F -- '--to-version'

# ============================================
# Stage 7: Schema Runner Postgres Dependencies
# ============================================
FROM oven/bun:1.3.9@sha256:856da45d07aeb62eb38ea3e7f9e1794c0143a4ff63efb00e6c4491b627e2a521 AS schema-runner-postgres-deps
WORKDIR /migrate
ENV BUN_INSTALL_CACHE_DIR=/tmp/.bun-install-cache

RUN cat <<'EOF' > package.json
{
  "name": "juanie-schema-runner-postgres-deps",
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
# Stage 8: Web Runner
# ============================================
# Next standalone only requires a compatible JavaScript runtime. Keep web and workers on one Bun baseline.
FROM bun-runtime-os AS web
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
COPY --from=source --chown=1001:1001 /app/templates ./templates
RUN mkdir -p ./.next/cache && chown -R 1001:1001 ./.next/cache

USER 1001:1001

EXPOSE 3001

CMD ["bun", "server.js"]

# ============================================
# Stage 9: Long-lived Runtime Runner
# ============================================
FROM bun-runtime-os AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache

COPY --from=worker-builder /app/worker ./worker
COPY --from=worker-builder /app/scheduler ./scheduler
COPY --from=worker-builder /app/restate-services ./restate-services
COPY --from=worker-builder /app/outbox-dispatcher ./outbox-dispatcher
COPY --from=worker-builder /app/control-plane-backup-uploader ./control-plane-backup-uploader
COPY --from=worker-builder /app/restate-snapshot ./restate-snapshot
COPY --from=source /app/templates ./templates

RUN mkdir -p /tmp/.cache \
  && chown -R 1001:1001 /tmp/.cache \
  && chmod +x ./worker ./scheduler ./restate-services ./outbox-dispatcher \
    ./control-plane-backup-uploader ./restate-snapshot

USER 1001:1001

CMD ["./worker"]

# ============================================
# Stage 10: Ephemeral Schema Runner
# ============================================
FROM bun-runtime-os AS schema-runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
ENV ATLAS_NO_UPDATE_NOTIFIER=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates findutils tar \
  && rm -rf /var/lib/apt/lists/*

COPY --from=atlas-distribution /usr/local/bin/atlas /usr/local/bin/atlas
COPY --from=worker-builder /app/schema-runner ./schema-runner
COPY --from=source /app/templates ./templates
COPY --from=source /app/migrations ./migrations
COPY --from=source /app/migrations-contract ./migrations-contract
COPY --from=schema-runner-postgres-deps /migrate/package.json ./package.json
COPY --from=schema-runner-postgres-deps /migrate/node_modules ./node_modules
RUN mkdir -p ./src/lib/releases /tmp/.cache \
  && chown -R 1001:1001 /tmp/.cache
COPY --from=source /app/src/lib/releases/recap-record.ts ./src/lib/releases/recap-record.ts
RUN chmod +x ./schema-runner /usr/local/bin/atlas

USER 1001:1001

CMD ["./schema-runner"]
