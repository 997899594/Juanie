# 模板示例

## 📦 Node.js + Express 模板

### 目录结构
```
templates/node-express/
├── template.yaml
├── README.md
├── app/
│   ├── src/
│   │   ├── index.ts
│   │   ├── app.ts
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   └── api.ts
│   │   ├── middleware/
│   │   │   ├── error.ts
│   │   │   └── logger.ts
│   │   └── utils/
│   │       └── logger.ts
│   ├── tests/
│   │   └── health.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── .eslintrc.js
│   ├── .prettierrc
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env.example
├── k8s/
│   ├── base/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── kustomization.yaml
│   └── overlays/
│       ├── dev/
│       │   ├── kustomization.yaml
│       │   └── patches.yaml
│       ├── staging/
│       │   ├── kustomization.yaml
│       │   └── patches.yaml
│       └── prod/
│           ├── kustomization.yaml
│           ├── patches.yaml
│           └── hpa.yaml
└── ci/
    ├── github-actions.yaml
    └── gitlab-ci.yaml
```

### app/src/index.ts
```typescript
import app from './app'
import { logger } from './utils/logger'

const PORT = process.env.PORT || 3000

const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
})
```

### app/src/app.ts
```typescript
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { healthRouter } from './routes/health'
import { apiRouter } from './routes/api'
import { errorHandler } from './middleware/error'
import { requestLogger } from './middleware/logger'

const app = express()

// Security middleware
app.use(helmet())
app.use(cors())

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Logging
app.use(requestLogger)

// Routes
app.use('/health', healthRouter)
app.use('/api', apiRouter)

// Error handling
app.use(errorHandler)

export default app
```

### app/Dockerfile
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### k8s/base/deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .appName }}
  labels:
    app: {{ .appName }}
    version: {{ .version | default "v1.0.0" }}
spec:
  replicas: {{ .replicas | default 1 }}
  selector:
    matchLabels:
      app: {{ .appName }}
  template:
    metadata:
      labels:
        app: {{ .appName }}
        version: {{ .version | default "v1.0.0" }}
    spec:
      containers:
      - name: app
        image: {{ .registry }}/{{ .appName }}:{{ .imageTag | default "latest" }}
        ports:
        - name: http
          containerPort: {{ .port | default 3000 }}
          protocol: TCP
        env:
        - name: NODE_ENV
          value: {{ .nodeEnv | default "production" }}
        - name: PORT
          value: "{{ .port | default 3000 }}"
        {{- if .enableDatabase }}
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: {{ .appName }}-secrets
              key: database-url
        {{- end }}
        {{- if .enableCache }}
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: {{ .appName }}-secrets
              key: redis-url
        {{- end }}
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        resources:
          requests:
            cpu: {{ .resources.requests.cpu | default "100m" }}
            memory: {{ .resources.requests.memory | default "128Mi" }}
          limits:
            cpu: {{ .resources.limits.cpu | default "500m" }}
            memory: {{ .resources.limits.memory | default "512Mi" }}
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
```

### ci/github-actions.yaml
```yaml
name: Build and Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    
    steps:
      - uses: actions/checkout@v4
        with:
          repository: ${{ github.repository }}-gitops
          token: ${{ secrets.GITOPS_TOKEN }}
      
      - name: Determine environment
        id: env
        run: |
          if [ "${{ github.ref }}" == "refs/heads/main" ]; then
            echo "environment=prod" >> $GITHUB_OUTPUT
          else
            echo "environment=dev" >> $GITHUB_OUTPUT
          fi
      
      - name: Update image tag
        run: |
          cd overlays/${{ steps.env.outputs.environment }}
          kustomize edit set image app=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.ref_name }}-${{ github.sha }}
      
      - name: Commit and push
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .
          git commit -m "Deploy ${{ github.sha }} to ${{ steps.env.outputs.environment }}"
          git push
```

---

## 📦 React + Vite 模板

### template.yaml
```yaml
apiVersion: juanie.io/v1
kind: ProjectTemplate
metadata:
  name: React + Vite SPA
  slug: react-vite
  version: 1.0.0
  category: web
  tags:
    - react
    - vite
    - typescript
    - spa
  icon: https://cdn.juanie.io/icons/react.svg

spec:
  description: |
    现代化的 React 单页应用模板
    使用 Vite 构建，支持 TypeScript、React Router、TanStack Query
  
  techStack:
    language: TypeScript
    framework: React 18
    runtime: Vite 5
    styling: Tailwind CSS
  
  features:
    - React 18 + TypeScript
    - Vite 5 快速构建
    - React Router v6
    - TanStack Query
    - Tailwind CSS
    - ESLint + Prettier
    - Vitest 单元测试
    - Nginx 生产部署
  
  defaults:
    port: 80
    environments:
      - name: dev
        type: development
        replicas: 1
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
      
      - name: prod
        type: production
        replicas: 2
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
    
    healthCheck:
      enabled: true
      path: /
      port: 80
      initialDelaySeconds: 10
      periodSeconds: 10
```

### app/Dockerfile
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

## 📦 Python + FastAPI 模板

### template.yaml
```yaml
apiVersion: juanie.io/v1
kind: ProjectTemplate
metadata:
  name: Python + FastAPI
  slug: python-fastapi
  version: 1.0.0
  category: api
  tags:
    - python
    - fastapi
    - rest-api
    - async
  icon: https://cdn.juanie.io/icons/python.svg

spec:
  description: |
    高性能的 Python FastAPI REST API 模板
    支持异步、自动文档、类型提示
  
  techStack:
    language: Python 3.12
    framework: FastAPI
    runtime: Uvicorn
    database: PostgreSQL (可选)
  
  features:
    - FastAPI + Pydantic
    - 异步支持
    - 自动 OpenAPI 文档
    - SQLAlchemy ORM
    - Alembic 数据库迁移
    - Poetry 依赖管理
    - Pytest 测试
    - Black + isort 格式化
  
  defaults:
    port: 8000
    environments:
      - name: dev
        type: development
        replicas: 1
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        envVars:
          LOG_LEVEL: debug
      
      - name: prod
        type: production
        replicas: 3
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        envVars:
          LOG_LEVEL: info
```

### app/Dockerfile
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install poetry
RUN pip install poetry==1.7.1

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction --no-ansi

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 🎯 使用方式

### 1. 通过 UI 创建项目
```
1. 点击"创建项目"
2. 选择模板（例如：Node.js + Express）
3. 填写参数：
   - 项目名称: my-api
   - 启用数据库: 是
   - 启用缓存: 是
4. 点击"创建"
5. 等待 30 秒
6. 完成！
```

### 2. 通过 CLI 创建项目
```bash
juanie create my-api \
  --template node-express \
  --enable-database \
  --enable-cache \
  --port 3000
```

### 3. 通过 API 创建项目
```typescript
const project = await trpc.projects.create.mutate({
  organizationId: 'org-123',
  name: 'My API',
  slug: 'my-api',
  templateId: 'node-express',
  parameters: {
    enableDatabase: true,
    enableCache: true,
    port: 3000,
  },
  repository: {
    mode: 'create',
    provider: 'github',
    name: 'my-api',
    visibility: 'private',
  },
})
```

---

## 📚 下一步

1. 实现模板加载服务
2. 创建实际的模板仓库
3. 实现模板渲染引擎
4. 更新前端组件
5. 编写文档和测试

