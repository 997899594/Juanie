# 🚀 Juanie AI - 多阶段Docker构建
# 实现高效的容器化部署和边缘节点分发

# ============================================================================
# 基础镜像 - 使用Alpine Linux减少镜像大小
# ============================================================================
FROM node:20-alpine AS base

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    curl \
    git \
    && rm -rf /var/cache/apk/*

# 设置环境变量
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# 安装pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ============================================================================
# 依赖安装阶段
# ============================================================================
FROM base AS deps

# 复制包管理文件
COPY package.json pnpm-lock.yaml* ./

# 安装依赖（包括开发依赖，用于构建）
RUN pnpm install --frozen-lockfile

# ============================================================================
# 构建阶段
# ============================================================================
FROM base AS builder

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 清理开发依赖，只保留生产依赖
RUN pnpm prune --prod

# ============================================================================
# 生产运行阶段
# ============================================================================
FROM base AS runner

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 juanie

# 设置工作目录
WORKDIR /app

# 复制构建产物和生产依赖
COPY --from=builder --chown=juanie:nodejs /app/dist ./dist
COPY --from=builder --chown=juanie:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=juanie:nodejs /app/package.json ./package.json

# 复制必要的配置文件
COPY --from=builder --chown=juanie:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=juanie:nodejs /app/tsconfig.json ./

# 创建必要的目录
RUN mkdir -p /app/logs /app/uploads /app/cache && \
    chown -R juanie:nodejs /app/logs /app/uploads /app/cache

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 暴露端口
EXPOSE 3000

# 切换到非root用户
USER juanie

# 启动应用
CMD ["node", "dist/main.js"]

# ============================================================================
# 开发阶段（可选）
# ============================================================================
FROM base AS development

# 安装开发工具
RUN apk add --no-cache \
    bash \
    vim \
    htop \
    && rm -rf /var/cache/apk/*

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 设置开发环境变量
ENV NODE_ENV=development
ENV PORT=3000
ENV HOST=0.0.0.0

# 暴露端口（包括调试端口）
EXPOSE 3000 9229

# 启动开发服务器
CMD ["pnpm", "dev"]

# ============================================================================
# 边缘节点优化阶段
# ============================================================================
FROM runner AS edge

# 安装边缘计算优化工具
USER root
RUN apk add --no-cache \
    redis \
    nginx \
    supervisor \
    && rm -rf /var/cache/apk/*

# 创建边缘缓存目录
RUN mkdir -p /var/cache/edge /var/log/edge && \
    chown -R juanie:nodejs /var/cache/edge /var/log/edge

# 设置边缘节点环境变量
ENV EDGE_MODE=true
ENV CACHE_STRATEGY=edge
ENV REDIS_URL=redis://localhost:6379

# 切换回非root用户
USER juanie

# 暴露边缘节点端口
EXPOSE 80 443 6379

# 启动应用（边缘模式）
CMD ["node", "dist/main.js"]

# ============================================================================
# 镜像元数据
# ============================================================================
LABEL maintainer="Juanie AI Team <dev@juanie.ai>"
LABEL version="1.0.0"
LABEL description="Juanie AI - Next-generation DevOps platform with AI-driven monitoring"
LABEL org.opencontainers.image.title="Juanie AI API"
LABEL org.opencontainers.image.description="AI-powered DevOps monitoring and automation platform"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Juanie AI"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/juanie-ai/platform"