# 多阶段构建 Dockerfile for Web (Vue 3 + Vite)
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

# 设置构建参数
ARG VITE_API_URL=https://api.juanie.art
ARG VITE_AI_API_URL=https://ai.juanie.art
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AI_API_URL=$VITE_AI_API_URL

# 替换 tsconfig 为 Docker 专用版本（避免 extends 解析问题）
RUN cp packages/shared/tsconfig.docker.json packages/shared/tsconfig.json && \
    cp packages/ui/tsconfig.docker.json packages/ui/tsconfig.json && \
    cp apps/web/tsconfig.docker.json apps/web/tsconfig.json

# 按依赖顺序构建工作区包: shared -> ui -> web
WORKDIR /app/packages/shared
RUN bunx vite build

WORKDIR /app/packages/ui
RUN bunx vite build

# 构建 web 应用
WORKDIR /app/apps/web
RUN bunx vite build

# ============================================
# Stage 3: Nginx 运行时
# ============================================
ARG REGISTRY_PREFIX=
FROM ${REGISTRY_PREFIX}nginx:alpine AS runner

# 安装必要工具
RUN apk add --no-cache tzdata curl && \
    rm -rf /var/cache/apk/*

# 设置时区
ENV TZ=Asia/Shanghai

# 复制 nginx 配置
COPY apps/web/nginx.conf /etc/nginx/nginx.conf

# 复制构建产物
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# 创建非 root 用户运行 nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
