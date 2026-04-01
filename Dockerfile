# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ============================================
# Stage 2: Builder (Next.js)
# ============================================
FROM deps AS builder
WORKDIR /app

COPY . .

ARG NEXT_PUBLIC_API_URL
ARG DATABASE_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV DATABASE_URL=${DATABASE_URL}

RUN bun run build

# ============================================
# Stage 3: Worker Builder (编译独立可执行文件)
# ============================================
FROM deps AS worker-builder
WORKDIR /app

COPY . .

# 编译 worker 为独立可执行文件 (约62MB, 包含所有依赖)
RUN bun build ./src/lib/queue/worker.ts --compile --outfile=worker

# ============================================
# Stage 4: Web Runner
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
# Stage 5: Worker Runner
# ============================================
FROM oven/bun:1 AS worker
WORKDIR /app

RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=worker-builder /app/worker ./worker
COPY --from=builder /app/templates ./templates

RUN chmod +x ./worker

CMD ["./worker"]

# ============================================
# Stage 6: Migration Runner
# ============================================
FROM oven/bun:1 AS migrate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN mkdir -p ./src/lib/db
COPY --from=builder /app/src/lib/db/schema.ts ./src/lib/db/schema.ts

CMD ["bun", "run", "db:push"]
