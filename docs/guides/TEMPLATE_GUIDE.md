# 项目模板使用指南

## 概述

项目模板是预定义的项目配置和资源结构，包含生产级的最佳实践。使用模板可以快速创建标准化的项目，减少配置错误。

---

## 系统预设模板

### 1. ⚛️ React 应用模板

**适用场景：** 单页应用（SPA）、前端项目

**技术栈：**
- React 18
- Nginx (静态文件服务器)
- Node.js 18 (构建环境)

**默认配置：**

```yaml
环境配置:
  development:
    replicas: 1
    resources:
      requests: { cpu: "100m", memory: "128Mi" }
      limits: { cpu: "200m", memory: "256Mi" }
    envVars:
      NODE_ENV: development
      
  staging:
    replicas: 2
    resources:
      requests: { cpu: "200m", memory: "256Mi" }
      limits: { cpu: "500m", memory: "512Mi" }
    envVars:
      NODE_ENV: staging
      
  production:
    replicas: 3
    resources:
      requests: { cpu: "500m", memory: "512Mi" }
      limits: { cpu: "1000m", memory: "1Gi" }
    envVars:
      NODE_ENV: production

健康检查:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 10
  periodSeconds: 10
  
就绪探针:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 5
  periodSeconds: 5
```

**生成的 Kubernetes 资源：**
- Deployment (Nginx 容器)
- Service (ClusterIP)
- Ingress (可选)
- ConfigMap (Nginx 配置)

**适合的项目类型：**
- React / Vue / Angular 应用
- 静态网站
- 前端微前端应用

---

### 2. 🟢 Node.js API 模板

**适用场景：** RESTful API、后端服务

**技术栈：**
- Node.js 18
- Express / Fastify
- PostgreSQL (可选)

**默认配置：**

```yaml
环境配置:
  development:
    replicas: 1
    resources:
      requests: { cpu: "200m", memory: "256Mi" }
      limits: { cpu: "500m", memory: "512Mi" }
    envVars:
      NODE_ENV: development
      PORT: "3000"
      DATABASE_URL: postgresql://localhost:5432/dev
      
  production:
    replicas: 3
    resources:
      requests: { cpu: "500m", memory: "512Mi" }
      limits: { cpu: "2000m", memory: "2Gi" }
    envVars:
      NODE_ENV: production
      PORT: "3000"
      DATABASE_URL: ${DATABASE_URL} # 从 Secret 读取

健康检查:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  
就绪探针:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
```

**生成的 Kubernetes 资源：**
- Deployment (Node.js 容器)
- Service (ClusterIP)
- Ingress (API 路由)
- ConfigMap (应用配置)
- Secret (数据库密码等)

**适合的项目类型：**
- RESTful API
- GraphQL 服务
- WebSocket 服务
- 后端微服务

---

### 3. 🔵 Go 微服务模板

**适用场景：** 高性能微服务、系统服务

**技术栈：**
- Go 1.21
- 最小化容器镜像 (scratch/alpine)

**默认配置：**

```yaml
环境配置:
  development:
    replicas: 1
    resources:
      requests: { cpu: "100m", memory: "64Mi" }
      limits: { cpu: "200m", memory: "128Mi" }
      
  production:
    replicas: 3
    resources:
      requests: { cpu: "200m", memory: "128Mi" }
      limits: { cpu: "1000m", memory: "512Mi" }

健康检查:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
```

**特点：**
- 最小化资源占用
- 快速启动时间
- 高性能

**适合的项目类型：**
- 微服务
- API Gateway
- 数据处理服务
- 系统工具

---

### 4. 🐍 Python API 模板

**适用场景：** 数据处理、机器学习 API

**技术栈：**
- Python 3.11
- FastAPI / Flask
- PostgreSQL (可选)

**默认配置：**

```yaml
环境配置:
  development:
    replicas: 1
    resources:
      requests: { cpu: "200m", memory: "256Mi" }
      limits: { cpu: "500m", memory: "512Mi" }
    envVars:
      PYTHON_ENV: development
      DATABASE_URL: postgresql://localhost:5432/dev
      
  production:
    replicas: 3
    resources:
      requests: { cpu: "500m", memory: "512Mi" }
      limits: { cpu: "2000m", memory: "2Gi" }
    envVars:
      PYTHON_ENV: production
      DATABASE_URL: ${DATABASE_URL}

健康检查:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10
```

**适合的项目类型：**
- RESTful API
- 数据处理服务
- 机器学习 API
- 爬虫服务

---

### 5. 📄 静态网站模板

**适用场景：** 文档网站、博客、营销页面

**技术栈：**
- Nginx
- HTML/CSS/JS

**默认配置：**

```yaml
环境配置:
  production:
    replicas: 2
    resources:
      requests: { cpu: "50m", memory: "64Mi" }
      limits: { cpu: "100m", memory: "128Mi" }

健康检查:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 5
  periodSeconds: 10
```

**特点：**
- 最小化资源占用
- 快速响应
- 简单配置

**适合的项目类型：**
- 文档网站
- 博客
- 营销页面
- 静态内容

---

## 自定义模板

### 创建自定义模板

组织管理员可以创建自定义模板：

1. 进入 **"组织设置"** → **"项目模板"**
2. 点击 **"创建自定义模板"**
3. 填写模板信息：

```yaml
基本信息:
  名称: Custom Node.js Template
  标识: custom-nodejs
  分类: api
  描述: 公司内部 Node.js 标准模板
  
技术栈:
  语言: JavaScript
  框架: Express
  运行时: Node.js 18
  
默认配置:
  环境: [development, staging, production]
  资源限制: { ... }
  健康检查: { ... }
  
K8s 模板:
  deployment: |
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: {{projectSlug}}
    spec:
      replicas: {{replicas}}
      template:
        spec:
          containers:
          - name: app
            image: {{image}}
            ...
```

4. 点击 **"保存"** 创建模板

### 模板变量

在 K8s 模板中可以使用以下变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{projectName}}` | 项目名称 | `My React App` |
| `{{projectSlug}}` | 项目标识 | `my-react-app` |
| `{{image}}` | 容器镜像 | `myorg/my-app:v1.0.0` |
| `{{replicas}}` | 副本数 | `3` |
| `{{environment}}` | 环境名称 | `production` |
| `{{namespace}}` | K8s 命名空间 | `my-org-production` |
| `{{cpu.requests}}` | CPU 请求 | `500m` |
| `{{cpu.limits}}` | CPU 限制 | `1000m` |
| `{{memory.requests}}` | 内存请求 | `512Mi` |
| `{{memory.limits}}` | 内存限制 | `1Gi` |
| `{{envVars}}` | 环境变量 | `NODE_ENV=production` |

**示例：使用变量的 Deployment 模板**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{projectSlug}}-{{environment}}
  namespace: {{namespace}}
  labels:
    app: {{projectSlug}}
    environment: {{environment}}
spec:
  replicas: {{replicas}}
  selector:
    matchLabels:
      app: {{projectSlug}}
      environment: {{environment}}
  template:
    metadata:
      labels:
        app: {{projectSlug}}
        environment: {{environment}}
    spec:
      containers:
      - name: app
        image: {{image}}
        ports:
        - containerPort: 3000
        env:
        {{#each envVars}}
        - name: {{@key}}
          value: "{{this}}"
        {{/each}}
        resources:
          requests:
            cpu: {{cpu.requests}}
            memory: {{memory.requests}}
          limits:
            cpu: {{cpu.limits}}
            memory: {{memory.limits}}
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

---

## 模板最佳实践

### 1. 资源限制

**推荐配置：**

```yaml
# 开发环境 - 最小化资源
development:
  requests: { cpu: "100m", memory: "128Mi" }
  limits: { cpu: "200m", memory: "256Mi" }

# 测试环境 - 模拟生产
staging:
  requests: { cpu: "200m", memory: "256Mi" }
  limits: { cpu: "500m", memory: "512Mi" }

# 生产环境 - 充足资源
production:
  requests: { cpu: "500m", memory: "512Mi" }
  limits: { cpu: "2000m", memory: "2Gi" }
```

**注意事项：**
- `requests` 是最小保证资源
- `limits` 是最大可用资源
- 避免设置过大的 `limits`，可能导致 OOM
- 根据实际负载调整

### 2. 健康检查

**推荐配置：**

```yaml
# 存活探针 - 检测应用是否存活
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30  # 应用启动时间
  periodSeconds: 10        # 检查间隔
  timeoutSeconds: 5        # 超时时间
  failureThreshold: 3      # 失败次数阈值

# 就绪探针 - 检测应用是否就绪
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

**注意事项：**
- `/health` 应该检查应用核心功能
- `/ready` 应该检查依赖服务（数据库、缓存等）
- `initialDelaySeconds` 应大于应用启动时间
- 避免健康检查过于复杂，影响性能

### 3. 环境变量

**推荐配置：**

```yaml
# 非敏感配置 - 使用 ConfigMap
envVars:
  NODE_ENV: production
  PORT: "3000"
  LOG_LEVEL: info
  API_URL: https://api.example.com

# 敏感配置 - 使用 Secret
secrets:
  DATABASE_URL: ${DATABASE_URL}
  API_KEY: ${API_KEY}
  JWT_SECRET: ${JWT_SECRET}
```

**注意事项：**
- 敏感信息必须使用 Secret
- 避免在代码中硬编码配置
- 使用环境变量注入配置

### 4. 副本数

**推荐配置：**

```yaml
development: 1   # 开发环境单副本
staging: 2       # 测试环境双副本
production: 3    # 生产环境至少 3 副本（高可用）
```

**注意事项：**
- 生产环境至少 2 副本（避免单点故障）
- 根据负载调整副本数
- 使用 HPA（Horizontal Pod Autoscaler）自动扩缩容

### 5. 安全上下文

**推荐配置：**

```yaml
securityContext:
  runAsNonRoot: true      # 不使用 root 用户
  runAsUser: 1000         # 指定用户 ID
  readOnlyRootFilesystem: true  # 只读根文件系统
  allowPrivilegeEscalation: false  # 禁止权限提升
  capabilities:
    drop:
    - ALL                 # 删除所有 capabilities
```

**注意事项：**
- 生产环境必须配置安全上下文
- 避免使用 root 用户运行容器
- 最小化容器权限

---

## 模板验证

### 验证模板配置

在创建自定义模板时，系统会自动验证：

1. **YAML 语法检查**
   - 检查 K8s YAML 是否符合规范
   - 检查必需字段是否存在

2. **资源配置检查**
   - 检查资源限制是否合理
   - 检查副本数是否有效

3. **变量检查**
   - 检查模板变量是否正确
   - 检查变量引用是否存在

4. **最佳实践检查**
   - 检查是否配置健康检查
   - 检查是否配置资源限制
   - 检查是否配置安全上下文

**验证失败示例：**

```
❌ 模板验证失败

错误:
  1. Deployment 缺少 livenessProbe 配置
  2. 资源限制 cpu.limits 不能小于 cpu.requests
  3. 变量 {{invalidVar}} 未定义

警告:
  1. 建议配置 securityContext
  2. 建议配置 readinessProbe
```

---

## 常见问题

### Q1: 如何选择合适的模板？

**A:** 根据项目类型选择：
- 前端项目 → React 应用模板
- 后端 API → Node.js / Go / Python API 模板
- 静态内容 → 静态网站模板

### Q2: 可以修改模板的默认配置吗？

**A:** 可以。在项目创建向导的"配置环境"步骤中，可以自定义所有配置。

### Q3: 如何更新已创建项目的模板？

**A:** 项目创建后，模板配置会固化到项目中。如果需要更新，可以：
1. 手动修改项目配置
2. 或重新创建项目

### Q4: 自定义模板可以共享给其他组织吗？

**A:** 不可以。自定义模板只在创建它的组织内可见。系统模板对所有组织可见。

### Q5: 如何删除自定义模板？

**A:** 在 **"组织设置"** → **"项目模板"** 中，找到模板并点击 **"删除"**。注意：已使用该模板的项目不受影响。

---

## 相关文档

- [项目创建指南](./PROJECT_CREATION_GUIDE.md)
- [Kubernetes 配置指南](./KUBERNETES_CONFIG_GUIDE.md)
- [安全最佳实践](./SECURITY_BEST_PRACTICES.md)
