# ============================================
# Stage 1: Builder (Next.js)
# ============================================
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_API_URL
ARG DATABASE_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV DATABASE_URL=${DATABASE_URL}

RUN bun run build

# ============================================
# Stage 2: Worker Builder (编译独立可执行文件)
# ============================================
FROM oven/bun:1 AS worker-builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# 只复制 worker 需要的源码
COPY src ./src
COPY drizzle ./drizzle
COPY drizzle.config.ts ./drizzle.config.ts
COPY tsconfig.json ./tsconfig.json

# 编译 worker 为独立可执行文件 (约62MB, 包含所有依赖)
RUN bun build ./src/lib/queue/worker.ts --compile --outfile=worker

# ============================================
# Stage 3: Runner
# ============================================
FROM oven/bun:1 AS runner
WORKDIR /app

# 安装 procps (pgrep for liveness probe)
RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 复制 Next.js standalone
COPY --from=builder /app/.next/standalone/server.js ./server.js
COPY --from=builder /app/.next/standalone/package.json ./package.json
COPY --from=builder /app/.next/standalone/node_modules ./node_modules
COPY --from=builder /app/.next/standalone/.next ./.next
COPY --from=builder /app/.next/static ./.next/static

# 复制 drizzle (db:push 需要)
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
RUN mkdir -p ./src/lib/db
COPY --from=builder /app/src/lib/db/schema.ts ./src/lib/db/schema.ts

# 安装 drizzle-kit (db:push 需要)
RUN bun add drizzle-kit

# 复制编译好的 worker 可执行文件
COPY --from=worker-builder /app/worker ./worker
RUN chmod +x ./worker

# 复制 CI/CD 模板（worker 运行时从 process.cwd()/templates/ 读取）
COPY --from=builder /app/templates ./templates

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
