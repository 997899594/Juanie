# 🚀 快速开始指南

## 项目初始化完整流程

### 1. 使用模板创建项目

```typescript
// 前端调用
const result = await trpc.projects.create.mutate({
  name: 'my-awesome-app',
  organizationId: 'org-123',
  templateId: 'nextjs-15-app',
  repository: {
    mode: 'create',
    provider: 'github',
    name: 'my-awesome-app',
    visibility: 'private',
    accessToken: '__USE_OAUTH__', // 使用 OAuth 令牌
  },
  environments: [
    { type: 'development', name: '开发环境' },
    { type: 'staging', name: '预发布环境' },
    { type: 'production', name: '生产环境' },
  ],
})

// 返回
{
  project: { id: 'proj-123', ... },
  jobIds: ['job-456'] // 用于监听进度
}
```

### 2. 监听实时进度

```typescript
// 连接 SSE
const eventSource = new EventSource(`/api/sse/project/${projectId}`)

// 监听进度事件
eventSource.addEventListener('initialization.progress', (event) => {
  const { state, progress, message } = JSON.parse(event.data)
  console.log(`${progress}% - ${message}`)
})

// 监听详细操作
eventSource.addEventListener('initialization.detail', (event) => {
  const { action, subProgress } = JSON.parse(event.data)
  console.log(`  └─ ${action} (${subProgress}%)`)
})

// 监听完成
eventSource.addEventListener('initialization.completed', (event) => {
  const { createdResources } = JSON.parse(event.data)
  console.log('✅ 初始化完成！', createdResources)
  eventSource.close()
})
```

### 3. 使用 AI 助手

```typescript
// 自然语言创建项目
const response = await trpc.ai.chat.mutate({
  message: '帮我创建一个 Next.js 15 项目，使用 GitHub，包含开发和生产环境',
  conversationId: 'conv-123',
})

// AI 会自动：
// 1. 识别意图（创建项目）
// 2. 提取参数（模板、Git 提供商、环境）
// 3. 执行操作
// 4. 返回结果

console.log(response.message) // "已为您创建项目..."
console.log(response.data) // { projectId: 'proj-123', ... }
```

### 4. 故障诊断

```typescript
// 诊断项目问题
const diagnosis = await trpc.ai.diagnose.mutate({
  projectId: 'proj-123',
  environmentId: 'env-456',
  useAI: true, // 使用 AI 分析
})

// 返回
{
  summary: '检测到 3 个问题',
  issues: [
    {
      severity: 'error',
      category: 'deployment',
      message: 'Pod 启动失败',
      suggestion: '检查镜像是否存在...',
    },
  ],
  recommendations: [
    '建议增加内存限制到 512Mi',
    '建议添加健康检查',
  ],
}
```

---

## 状态机流程

```
IDLE (0%)
  ↓ START
CREATING_PROJECT (10%)
  ↓ PROJECT_CREATED
LOADING_TEMPLATE (20%)
  ↓ TEMPLATE_LOADED
RENDERING_TEMPLATE (30%)
  ↓ TEMPLATE_RENDERED
CREATING_ENVIRONMENTS (50%)
  ↓ ENVIRONMENTS_CREATED
SETTING_UP_REPOSITORY (70%)
  ↓ REPOSITORY_SETUP
FINALIZING (85%)
  ↓ FINALIZED
COMPLETED (100%)
```

每个状态都会：
1. 推送进度事件
2. 执行相应操作
3. 更新数据库
4. 触发下一个状态

---

## 核心服务

### TemplateLoader

```typescript
// 加载模板
const template = await templateLoader.loadTemplate('nextjs-15-app')

// 返回
{
  id: 'nextjs-15-app',
  name: 'Next.js 15 App',
  description: '...',
  path: '/path/to/templates/nextjs-15-app',
  config: { ... },
}
```

### TemplateRenderer

```typescript
// 渲染模板
await templateRenderer.render({
  templatePath: '/path/to/template',
  outputPath: '/path/to/output',
  variables: {
    projectName: 'my-app',
    port: 3000,
  },
})

// 会渲染所有文件，替换变量
```

### OneClickDeployService

```typescript
// 一键部署
const result = await oneClickDeploy.deploy({
  name: 'my-app',
  organizationId: 'org-123',
  templateId: 'nextjs-15-app',
  repository: { ... },
  environments: [ ... ],
})

// 并行创建所有资源
// 30 秒内完成
```

---

## 模板结构

```
templates/nextjs-15-app/
├── template.yaml          # 模板元数据
├── app/                   # 应用代码
│   ├── package.json
│   ├── src/
│   └── ...
├── k8s/                   # Kubernetes 配置
│   ├── base/
│   └── overlays/
├── ci/                    # CI/CD 配置
│   ├── github-actions.yaml
│   └── gitlab-ci.yaml
├── docs/                  # 文档
└── README.md
```

### template.yaml

```yaml
id: nextjs-15-app
name: Next.js 15 App
description: Next.js 15 with App Router
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - typescript

variables:
  - name: projectName
    type: string
    required: true
  - name: port
    type: number
    default: 3000

files:
  - path: app/**/*
    action: copy
  - path: k8s/**/*.yaml
    action: render
```

---

## 环境变量

```bash
# 数据库
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://localhost:6379

# Git 提供商
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITLAB_CLIENT_ID=...
GITLAB_CLIENT_SECRET=...

# AI
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1

# Kubernetes
KUBECONFIG=/path/to/kubeconfig
```

---

## 常见问题

### Q: 如何添加新模板？

1. 在 `templates/` 目录创建新文件夹
2. 添加 `template.yaml` 配置
3. 添加应用代码和配置文件
4. 重启服务，模板会自动加载

### Q: 如何自定义状态机流程？

1. 在 `initialization/handlers/` 添加新 Handler
2. 实现 `StateHandler` 接口
3. 在 `state-machine.ts` 注册 Handler
4. 更新状态转换表

### Q: 如何调试初始化流程？

1. 查看日志：`docker logs api-gateway`
2. 查看 Redis 队列：`redis-cli LLEN bull:project-initialization:wait`
3. 查看数据库：`SELECT * FROM projects WHERE id = 'proj-123'`
4. 连接 SSE 查看实时进度

### Q: 如何处理初始化失败？

系统会自动：
1. 标记项目状态为 `failed`
2. 记录错误信息
3. 推送错误事件到 SSE
4. 保留已创建的资源（不自动删除）

手动清理：
```typescript
await trpc.projects.delete.mutate({
  projectId: 'proj-123',
  repositoryAction: 'delete', // 同时删除仓库
})
```

---

## 性能指标

- **项目创建**: < 30 秒
- **模板渲染**: < 5 秒
- **环境创建**: < 10 秒（并行）
- **仓库创建**: < 15 秒
- **总耗时**: < 1 分钟

---

## 下一步

1. 阅读 [架构文档](./docs/ARCHITECTURE.md)
2. 查看 [API 参考](./docs/API_REFERENCE.md)
3. 学习 [开发指南](./docs/DEVELOPMENT.md)
4. 探索 [模板示例](./TEMPLATE_EXAMPLES.md)

Happy coding! 🚀
