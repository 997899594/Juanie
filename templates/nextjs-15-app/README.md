# Next.js 15 App Router Template

🚀 2025 年最前沿的 Next.js 15 全栈应用模板

## ✨ 特性

### Next.js 15 新特性
- ⚡ **Turbopack** - 比 Webpack 快 700 倍的构建工具
- 🎯 **React Server Components** - 服务端组件
- 🔄 **Server Actions** - 服务端操作
- 📦 **Partial Prerendering (PPR)** - 部分预渲染
- 🎨 **Tailwind CSS 4** - 最新版本

### 开发体验
- 🛠️ TypeScript 严格模式
- 📝 ESLint + Prettier
- 🎭 Playwright E2E 测试
- ⚡ Vitest 单元测试

### UI/UX
- 🎨 shadcn/ui 组件库
- 🌗 深色模式支持
- 📱 响应式设计
- ♿ 无障碍支持

{{#if enableAuth}}
### 认证
- 🔐 NextAuth.js v5
- 🔑 多种 OAuth 提供商支持
{{/if}}

{{#if enableDatabase}}
### 数据库
- 🗄️ PostgreSQL 16
- ⚡ Drizzle ORM
- 🔄 自动迁移
{{/if}}

{{#if enableCache}}
### 缓存
- ⚡ Redis 7
- 🚀 高性能缓存
{{/if}}

### DevOps
- 🐳 Docker 多阶段构建
- ☸️ Kubernetes 部署
- 🔄 Flux CD GitOps
- 📊 自动扩缩容 (HPA)
- 🔍 健康检查
- 📈 监控和日志

## 🚀 快速开始

### 前置要求

- Node.js 20+
- npm 10+
{{#if enableDatabase}}
- PostgreSQL 16+
{{/if}}
{{#if enableCache}}
- Redis 7+
{{/if}}

### 本地开发

1. **克隆项目**
```bash
git clone <repository-url>
cd <%= projectSlug %>
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填写必要的配置
```

{{#if enableDatabase}}
4. **设置数据库**
```bash
npm run db:push
```
{{/if}}

5. **启动开发服务器**
```bash
npm run dev
```

访问 [http://localhost:<%= port %>](http://localhost:<%= port %>)

## 📦 可用脚本

```bash
# 开发
npm run dev          # 启动开发服务器（使用 Turbopack）
npm run build        # 构建生产版本
npm run start        # 启动生产服务器

# 代码质量
npm run lint         # 运行 ESLint
npm run type-check   # TypeScript 类型检查
npm run format       # 格式化代码

# 测试
npm test             # 运行单元测试
npm run test:e2e     # 运行 E2E 测试

{{#if enableDatabase}}
# 数据库
npm run db:generate  # 生成迁移文件
npm run db:push      # 推送 schema 到数据库
npm run db:studio    # 打开 Drizzle Studio
npm run db:migrate   # 运行迁移
{{/if}}
```

## 🏗️ 项目结构

```
{{ appName }}/
├── src/
│   ├── app/              # App Router 页面
│   │   ├── api/          # API 路由
│   │   ├── layout.tsx    # 根布局
│   │   └── page.tsx      # 首页
│   ├── components/       # React 组件
│   │   ├── ui/           # shadcn/ui 组件
│   │   └── providers.tsx # Context Providers
│   ├── lib/              # 工具函数
│   │   ├── db.ts         # 数据库客户端
│   │   ├── redis.ts      # Redis 客户端
│   │   └── utils.ts      # 通用工具
│   ├── hooks/            # 自定义 Hooks
│   ├── types/            # TypeScript 类型
│   └── styles/           # 全局样式
├── public/               # 静态资源
├── tests/                # 测试文件
├── .github/              # GitHub Actions
├── Dockerfile            # Docker 配置
└── next.config.js        # Next.js 配置
```

## 🐳 Docker

### 构建镜像

```bash
docker build -t {{ appName }}:latest .
```

### 运行容器

```bash
docker run -p {{ port }}:{{ port }} \
  -e DATABASE_URL=postgresql://... \
  {{ appName }}:latest
```

## ☸️ Kubernetes 部署

### 前置要求

- Kubernetes 集群 (K3s/K8s)
- Flux CD 已安装
- kubectl 已配置

### 部署步骤

1. **创建命名空间**
```bash
kubectl create namespace {{ appName }}-dev
```

2. **创建 Secrets**
```bash
kubectl create secret generic {{ appName }}-secrets \
  --from-literal=database-url=postgresql://... \
  --from-literal=nextauth-secret=... \
  -n {{ appName }}-dev
```

3. **应用 Kustomize 配置**
```bash
kubectl apply -k k8s/overlays/development
```

4. **检查部署状态**
```bash
kubectl get pods -n {{ appName }}-dev
kubectl logs -f deployment/{{ appName }} -n {{ appName }}-dev
```

## 🔄 GitOps 工作流

1. **推送代码到 main/develop 分支**
2. **GitHub Actions 自动构建 Docker 镜像**
3. **更新 GitOps 仓库的镜像标签**
4. **Flux CD 自动同步到 Kubernetes**
5. **应用自动部署和健康检查**

## 📊 监控

### 健康检查

```bash
curl http://localhost:{{ port }}/api/health
```

{{#if enableAnalytics}}
### Vercel Analytics

访问 [Vercel Dashboard](https://vercel.com/analytics) 查看分析数据
{{/if}}

{{#if enableSentry}}
### Sentry

访问 [Sentry Dashboard](https://sentry.io) 查看错误追踪
{{/if}}

## 🔧 配置

### 环境变量

查看 `.env.example` 了解所有可用的环境变量

### Next.js 配置

编辑 `next.config.js` 自定义 Next.js 行为

### Tailwind 配置

编辑 `tailwind.config.ts` 自定义样式

## 📚 文档

- [Next.js 文档](https://nextjs.org/docs)
- [React 文档](https://react.dev)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
{{#if enableDatabase}}
- [Drizzle ORM 文档](https://orm.drizzle.team)
{{/if}}
{{#if enableAuth}}
- [NextAuth.js 文档](https://next-auth.js.org)
{{/if}}

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**Built with ❤️ using Next.js 15 and deployed on Kubernetes**
