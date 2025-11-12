# 多阶段构建 Dockerfile for Bun + NestJS + tRPC
# 优化镜像大小和构建速度

# ============================================
# Stage 1: 依赖安装
# ============================================
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# 复制 package.json 和 lockfile
COPY package.json bun.lock* ./
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY packages/*/package.json ./packages/

# 安装生产依赖
RUN bun install --frozen-lockfile --production

# ============================================
# Stage 2: 构建
# ============================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api-gateway/node_modules ./apps/api-gateway/node_modules

# 复制源代码
COPY . .

# 构建应用
WORKDIR /app/apps/api-gateway
RUN bun run build

# ============================================
# Stage 3: 运行时
# ============================================
FROM oven/bun:1-alpine AS runner

# 安装必要的运行时依赖
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# 安装 Flux CLI（用于管理 K3s 集群中的 Flux）
RUN curl -s https://fluxcd.io/install.sh | bash

# 安装 kubectl（用于与 K3s 集群通信）
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl

# 设置时区
ENV TZ=Asia/Shanghai

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# 复制必要文件
COPY --from=builder --chown=nestjs:nodejs /app/apps/api-gateway/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api-gateway/package.json ./
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# 切换到非 root 用户
USER nestjs

# 暴露端口
EXPOSE 3001
EXPOSE 9465

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD bun run -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# 启动应用
CMD ["bun", "run", "dist/main.js"]
