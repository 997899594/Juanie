# ============================================
# Stage 1: Source
# ============================================
FROM scratch AS source
COPY . /app

# ============================================
# Stage 2: Dependencies
# ============================================
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ============================================
# Stage 3: Builder (Next.js)
# ============================================
FROM deps AS builder
WORKDIR /app

COPY --from=source /app ./

ARG NEXT_PUBLIC_API_URL
ARG DATABASE_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV DATABASE_URL=${DATABASE_URL}

RUN mkdir -p public && bun run build

# ============================================
# Stage 4: Worker Builder
# ============================================
FROM deps AS worker-builder
WORKDIR /app

COPY --from=source /app ./

# 编译队列 worker 为独立可执行文件
RUN bun build ./src/lib/queue/worker.ts --compile --outfile=worker

# ============================================
# Stage 5: Migration Builder
# ============================================
FROM oven/bun:1 AS migrate-deps
WORKDIR /migrate

RUN cat <<'EOF' > package.json
{
  "name": "juanie-migrate",
  "private": true,
  "type": "module",
  "dependencies": {
    "drizzle-kit": "0.30.6",
    "drizzle-orm": "0.38.4",
    "pg": "8.20.0",
    "postgres": "3.4.8",
    "typescript": "5.9.3"
  }
}
EOF

RUN bun install --production

# ============================================
# Stage 6: Web Runner
# ============================================
FROM node:20-bookworm-slim AS web
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# 复制 Next.js standalone
COPY --from=builder /app/.next/standalone/server.js ./server.js
COPY --from=builder /app/.next/standalone/package.json ./package.json
COPY --from=builder /app/.next/standalone/node_modules ./node_modules
COPY --from=builder /app/.next/standalone/.next ./.next
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3001

CMD ["node", "server.js"]

# ============================================
# Stage 7: Worker Runner
# ============================================
FROM oven/bun:1 AS worker
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=worker-builder /app/worker ./worker
COPY --from=source /app/templates ./templates

RUN chmod +x ./worker

CMD ["./worker"]

# ============================================
# Stage 8: Migration Runner
# ============================================
FROM oven/bun:1 AS migrate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=migrate-deps /migrate/package.json ./package.json
COPY --from=migrate-deps /migrate/node_modules ./node_modules
COPY --from=source /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=source /app/tsconfig.json ./tsconfig.json

RUN mkdir -p ./src/lib/db ./src/lib/releases
COPY --from=source /app/src/lib/db/schema.ts ./src/lib/db/schema.ts
COPY --from=source /app/src/lib/releases/recap-record.ts ./src/lib/releases/recap-record.ts

CMD ["bunx", "drizzle-kit", "push", "--config", "./drizzle.config.ts"]
