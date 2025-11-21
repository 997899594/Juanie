# syntax=docker/dockerfile:1

# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production && \
    npm cache clean --force

# Builder stage
FROM base AS builder
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 构建应用
RUN npm run build

# Runner stage
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE {{ .port }}

ENV PORT={{ .port }}
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
