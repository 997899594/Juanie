# 多阶段构建 Dockerfile for Bun + NestJS + tRPC
# 优化镜像大小和构建速度

# Base image registry (use docker.m.daocloud.io for China, empty for Docker Hub)
ARG REGISTRY_PREFIX=

# ============================================
# Stage 1: 构建
# ============================================
FROM ${REGISTRY_PREFIX}oven/bun:1-alpine AS builder

WORKDIR /app

# 复制所有源代码（.dockerignore 排除了不需要的文件）
COPY . .

# 安装所有依赖
RUN rm -f bun.lock && bun install --ignore-scripts

# 构建 api-gateway 及其依赖
WORKDIR /app

# 按顺序构建工作区包（只构建 api-gateway 需要的）
RUN cd packages/core/errors && bun run build || true && \
    cd /app/packages/types && bun run build || true && \
    cd /app/packages/database && bun run build || true && \
    cd /app/packages/core && bun run build || true && \
    cd /app/packages/services/foundation && bun run build || true && \
    cd /app/packages/services/business && bun run build || true && \
    cd /app/packages/services/extensions && bun run build || true && \
    cd /app/apps/api-gateway && bun run build || true

# 如果 tsc 失败，使用 bun 的源码运行模式（不需要预编译）
WORKDIR /app/apps/api-gateway

# ============================================
# Stage 2: 运行时
# ============================================
ARG REGISTRY_PREFIX=
FROM ${REGISTRY_PREFIX}oven/bun:1-alpine AS runner

# 安装必要的运行时依赖
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# 设置时区
ENV TZ=Asia/Shanghai

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# 复制整个应用（bun 可以直接运行 TypeScript）
COPY --from=builder --chown=nestjs:nodejs /app ./

# 切换到非 root 用户
USER nestjs

# 暴露端口
EXPOSE 3001
EXPOSE 9465

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# 启动应用（bun 原生支持 TypeScript）
WORKDIR /app/apps/api-gateway
CMD ["bun", "run", "src/main.ts"]
