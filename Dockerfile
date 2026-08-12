# ============================================
# Stage 1: Source
# ============================================
FROM scratch AS source
COPY . /app

# ============================================
# Stage 2: Reproducible Bun Bases
# ============================================
FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS bun-build-os
FROM oven/bun:1.3.14-distroless@sha256:c28c51287af70bab8e0b66fc4b6a30cfb92a727ebc88045223adc9f4c9d09307 AS bun-runtime-os
FROM node:26.7.0-bookworm-slim@sha256:cd565714d4da3e84bfd341e31448f81d47c6362198f152345297c9c1154e6341 AS node-toolchain

# ============================================
# Stage 3: Dependencies
# ============================================
FROM bun-build-os AS deps
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

RUN mkdir -p public \
  && bun run build \
  && mkdir -p /app/.next/standalone/.next/cache

# ============================================
# Stage 5: Long-Lived Runtime Builder
# ============================================
FROM deps AS runtime-builder
WORKDIR /app

COPY --from=source /app ./

# Compile long-lived control-plane services as independent Bun executables.
RUN bun build ./src/lib/queue/worker.ts --compile --outfile=worker
RUN bun build ./src/lib/queue/scheduler.ts --compile --outfile=scheduler
RUN bun build ./src/lib/restate/server.ts --compile --outfile=restate-services
RUN bun build ./src/lib/outbox/dispatcher.ts --compile --outfile=outbox-dispatcher
RUN bun build ./src/lib/backups/control-plane-uploader.ts --compile --outfile=control-plane-backup-uploader
RUN bun build ./src/lib/backups/restate-snapshot.ts --compile --outfile=restate-snapshot
RUN bun build ./src/lib/ci/application-delivery-preflight.ts --compile --outfile=application-delivery-preflight

# ============================================
# Stage 6: Schema Runner Builder
# ============================================
FROM deps AS schema-runner-builder
WORKDIR /app

COPY --from=source /app ./

RUN bun build ./src/lib/schema-management/schema-runner.ts --compile --outfile=schema-runner

# ============================================
# Stage 7: Reproducible Atlas Community Builder
# ============================================
FROM bun-build-os AS atlas-builder
WORKDIR /build

ARG TARGETARCH=amd64
ARG GO_VERSION=1.26.5
ARG GO_SHA256_AMD64=5c2c3b16caefa1d968a94c1daca04a7ca301a496d9b086e17ad77bb81393f053
ARG GO_SHA256_ARM64=fe4789e92b1f33358680864bbe8704289e7bb5fc207d80623c308935bd696d49
ARG ATLAS_VERSION=1.2.3
ARG ATLAS_SOURCE_SHA256=e500c88c4bcabe853d596c576ac44d5985ba265c4ef431d93299d8349b3f98e0
ARG ATLAS_GRPC_VERSION=1.82.1

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN case "${TARGETARCH}" in \
      amd64) go_sha256="${GO_SHA256_AMD64}" ;; \
      arm64) go_sha256="${GO_SHA256_ARM64}" ;; \
      *) echo "Unsupported Go architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
  && curl --fail --location --retry 5 --retry-all-errors \
      "https://go.dev/dl/go${GO_VERSION}.linux-${TARGETARCH}.tar.gz" \
      --output /tmp/go.tar.gz \
  && echo "${go_sha256}  /tmp/go.tar.gz" | sha256sum -c - \
  && tar -C /usr/local -xzf /tmp/go.tar.gz \
  && rm /tmp/go.tar.gz

RUN curl --fail --location --retry 5 --retry-all-errors \
      "https://github.com/ariga/atlas/archive/refs/tags/v${ATLAS_VERSION}.tar.gz" \
      --output /tmp/atlas.tar.gz \
  && echo "${ATLAS_SOURCE_SHA256}  /tmp/atlas.tar.gz" | sha256sum -c - \
  && mkdir /build/atlas \
  && tar -C /build/atlas --strip-components=1 -xzf /tmp/atlas.tar.gz \
  && rm /tmp/atlas.tar.gz \
  && cd /build/atlas/cmd/atlas \
  && /usr/local/go/bin/go mod edit -require="google.golang.org/grpc@v${ATLAS_GRPC_VERSION}" \
  && GOTOOLCHAIN=local /usr/local/go/bin/go mod download \
  && CGO_ENABLED=1 GOTOOLCHAIN=local /usr/local/go/bin/go build \
      -mod=mod \
      -trimpath \
      -ldflags "-s -w -buildid= -X ariga.io/atlas/cmd/atlas/internal/cmdapi.version=v${ATLAS_VERSION}" \
      -o /usr/local/bin/atlas . \
  && /usr/local/go/bin/go version -m /usr/local/bin/atlas \
      | grep -F 'google.golang.org/grpc' \
      | grep -F "v${ATLAS_GRPC_VERSION}" \
  && /usr/local/bin/atlas version \
  && /usr/local/bin/atlas migrate apply --help | grep -F -- 'apply [flags] [amount]' \
  && /usr/local/bin/atlas migrate apply --help | grep -F -- '--exec-order' \
  && ! /usr/local/bin/atlas migrate apply --help | grep -F -- '--to-version'

# ============================================
# Stage 8: Schema Runner Postgres Dependencies
# ============================================
FROM bun-build-os AS schema-runner-postgres-deps
WORKDIR /migrate
ENV BUN_INSTALL_CACHE_DIR=/tmp/.bun-install-cache

RUN cat <<'EOF' > package.json
{
  "name": "juanie-schema-runner-postgres-deps",
  "private": true,
  "type": "module",
  "dependencies": {
    "corepack": "0.34.5",
    "postgres": "3.4.8"
  }
}
EOF

RUN rm -rf "${BUN_INSTALL_CACHE_DIR}" \
  && mkdir -p "${BUN_INSTALL_CACHE_DIR}" \
  && bun install --production --no-cache --backend=copyfile --network-concurrency=8

# ============================================
# Stage 9: Web Runner
# ============================================
# Next standalone is a Node server. Keep Bun for builds and compiled control-plane services.
FROM node-toolchain AS web
WORKDIR /app

RUN /usr/local/bin/node --version \
  && rm -rf /usr/local/lib/node_modules \
  && rm -f \
    /usr/local/bin/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg

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

USER 1001:1001

EXPOSE 3001

ENTRYPOINT []
CMD ["/usr/local/bin/node", "server.js"]

# ============================================
# Stage 10: Long-lived Runtime Runner
# ============================================
FROM bun-runtime-os AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache

COPY --from=runtime-builder --chown=1001:1001 --chmod=755 /app/worker ./worker
COPY --from=runtime-builder --chown=1001:1001 --chmod=755 /app/scheduler ./scheduler
COPY --from=runtime-builder --chown=1001:1001 --chmod=755 /app/restate-services ./restate-services
COPY --from=runtime-builder --chown=1001:1001 --chmod=755 /app/outbox-dispatcher ./outbox-dispatcher
COPY --from=runtime-builder --chown=1001:1001 --chmod=755 /app/control-plane-backup-uploader ./control-plane-backup-uploader
COPY --from=runtime-builder --chown=1001:1001 --chmod=755 /app/restate-snapshot ./restate-snapshot
COPY --from=runtime-builder --chown=1001:1001 --chmod=755 /app/application-delivery-preflight ./application-delivery-preflight
COPY --from=source /app/templates ./templates

USER 1001:1001

ENTRYPOINT []
CMD ["./worker"]

# ============================================
# Stage 11: Ephemeral Schema Runner
# ============================================
FROM bun-build-os AS schema-runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
ENV ATLAS_NO_UPDATE_NOTIFIER=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    findutils \
    libcap2=1:2.75-10+deb13u1+b1 \
    libssl3t64=3.5.6-1~deb13u2 \
    openssl-provider-legacy=3.5.6-1~deb13u2 \
    tar \
  && rm -rf /var/lib/apt/lists/*

COPY --from=atlas-builder /usr/local/bin/atlas /usr/local/bin/atlas
COPY --from=node-toolchain /usr/local/bin/node /usr/local/bin/node
COPY --from=schema-runner-builder /app/schema-runner ./schema-runner
COPY --from=source /app/templates ./templates
COPY --from=source /app/migrations ./migrations
COPY --from=source /app/migrations-contract ./migrations-contract
COPY --from=schema-runner-postgres-deps /migrate/package.json ./package.json
COPY --from=schema-runner-postgres-deps /migrate/node_modules ./node_modules
RUN mkdir -p ./src/lib/releases /tmp/.cache \
  && chown -R 1001:1001 /tmp/.cache
COPY --from=source /app/src/lib/releases/recap-record.ts ./src/lib/releases/recap-record.ts
RUN chmod +x ./schema-runner /usr/local/bin/atlas /usr/local/bin/node \
  && /usr/local/bin/node --version \
  && /usr/local/bin/node /app/node_modules/corepack/dist/corepack.js --version

USER 1001:1001

CMD ["./schema-runner"]
