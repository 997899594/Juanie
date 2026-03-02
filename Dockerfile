# ============================================
# Stage 1: Builder
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
# Stage 2: Runner
# ============================================
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone/server.js ./server.js
COPY --from=builder /app/.next/standalone/package.json ./package.json
COPY --from=builder /app/.next/standalone/node_modules ./node_modules
COPY --from=builder /app/.next/standalone/.next ./.next
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
