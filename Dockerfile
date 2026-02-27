# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1.2 AS deps
WORKDIR /app

# 安装依赖
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production=false

# ============================================
# Stage 2: Builder
# ============================================
FROM oven/bun:1.2 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置构建时环境变量
ARG NEXT_PUBLIC_API_URL
ARG DATABASE_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV DATABASE_URL=${DATABASE_URL}

# 构建应用
RUN bun run build

# ============================================
# Stage 3: Runner
# ============================================
FROM oven/bun:1.2 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# 复制 .next 目录
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 删除不需要的配置文件
RUN rm -f ./biome.json ./tsconfig.json ./drizzle.config.ts

# 复制 node_modules (用于 worker)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle.config ./

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# 启动脚本
CMD ["node", "server.js"]
