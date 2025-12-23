# Next.js 15 多阶段构建 Dockerfile (Bun 版本)
# 使用 Bun 提供更快的安装和构建速度

# ============================================
# 阶段 1: 依赖安装
# ============================================
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# 复制依赖文件
COPY app/package.json app/bun.lockb* app/package-lock.json* ./

# 安装生产依赖
RUN bun install --frozen-lockfile --production

# ============================================
# 阶段 2: 构建应用
# ============================================
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# 复制依赖文件
COPY app/package.json app/bun.lockb* app/package-lock.json* ./

# 安装所有依赖（包括 devDependencies）
RUN bun install --frozen-lockfile

# 复制源代码（从 app/ 目录）
COPY app/ .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 构建应用
RUN bun run build

# ============================================
# 阶段 3: 运行时镜像
# ============================================
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 设置文件权限
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# 启动应用（使用 Bun 运行 Node.js 应用）
CMD ["bun", "run", "server.js"]
