# Juanie DevOps 平台架构文档

本文档详细介绍 Juanie 平台的系统架构设计。

## 📚 目录

- [架构概览](#架构概览)
- [技术栈](#技术栈)
- [三层服务架构](#三层服务架构)
- [数据流](#数据流)
- [部署架构](#部署架构)
- [安全架构](#安全架构)

## 架构概览

Juanie 采用现代化的微服务架构，基于 Monorepo 管理，支持多租户和高可扩展性。

```mermaid
graph TB
    subgraph "客户端层"
        Web[Web 应用<br/>Vue 3 + Vite]
    end

    subgraph "API 网关层"
        Gateway[API Gateway<br/>NestJS + Fastify + tRPC]
    end

    subgraph "服务层"
        Foundation[基础服务层<br/>Foundation]
        Business[业务服务层<br/>Business]
        Extensions[扩展服务层<br/>Extensions]
    end

    subgraph "基础设施层"
        DB[(PostgreSQL<br/>Database)]
        Cache[(Dragonfly<br/>Redis-Compatible)]
        Queue[BullMQ<br/>Job Queue]
        Ollama[Ollama<br/>AI Models]
    end

    subgraph "容器编排层"
        K3s[K3s Cluster]
        Flux[Flux CD]
    end

    subgraph "监控层"
        Jaeger[Jaeger<br/>Tracing]
        Prometheus[Prometheus<br/>Metrics]
        Grafana[Grafana<br/>Visualization]
    end

    Web -->|tRPC| Gateway
    Gateway --> Foundation
    Gateway --> Business
    Gateway --> Extensions
    
    Foundation --> DB
    Foundation --> Cache
    
    Business --> DB
    Business --> Queue
    Business --> K3s
    
    Extensions --> Ollama
    Extensions --> Queue
    
    Gateway -.->|OpenTelemetry| Jaeger
    Gateway -.->|Metrics| Prometheus
    Grafana -.->|Query| Prometheus
    
    Business -->|GitOps| Flux
    Flux -->|Manage| K3s
```

## 技术栈

### 后端技术栈

```mermaid
mindmap
  root((后端技术栈))
    运行时
      Bun 1.0+
      Node.js 22+
    框架
      NestJS 11
      Fastify
      tRPC 11
    数据库
      PostgreSQL 15
      Drizzle ORM
    缓存/队列
      Dragonfly Redis
      BullMQ
    容器编排
      K3s
      Flux CD
    监控
      OpenTelemetry
      Jaeger
      Prometheus
```

### 前端技术栈

```mermaid
mindmap
  root((前端技术栈))
    框架
      Vue 3.5
      Composition API
    构建
      Vite 7
      TypeScript 5
    状态管理
      Pinia 3
      VueUse
    路由
      Vue Router 4.5
    UI 组件
      Shadcn/ui
      Radix Vue
      Tailwind CSS 4
    图表
      Unovis
      ECharts
```

## 三层服务架构

Juanie 采用经典的三层架构设计，每层职责明确，依赖关系单向。

```mermaid
graph TD
    subgraph "Extension Layer 扩展服务层"
        AI[AI Service<br/>代码审查、智能推荐]
        Monitoring[Monitoring Service<br/>监控告警]
        Notifications[Notification Service<br/>消息通知]
        Security[Security Service<br/>安全扫描]
    end

    subgraph "Business Layer 业务服务层"
        Projects[Projects Service<br/>项目管理]
        Deployments[Deployments Service<br/>部署管理]
        Environments[Environments Service<br/>环境管理]
        Pipelines[Pipelines Service<br/>流水线]
        Repositories[Repositories Service<br/>代码仓库]
        GitOps[GitOps Service<br/>GitOps 编排]
    end

    subgraph "Foundation Layer 基础服务层"
        Auth[Auth Service<br/>认证授权]
        Users[Users Service<br/>用户管理]
        Organizations[Organizations Service<br/>组织管理]
        Teams[Teams Service<br/>团队管理]
        AuditLogs[Audit Logs Service<br/>审计日志]
    end

    AI -.->|依赖| Projects
    Monitoring -.->|依赖| Deployments
    Notifications -.->|依赖| Users

    Projects -->|依赖| Organizations
    Projects -->|依赖| Auth
    Deployments -->|依赖| Projects
    GitOps -->|依赖| Projects

    Organizations -->|依赖| Users
    Teams -->|依赖| Organizations

    style AI fill:#e1f5ff
    style Monitoring fill:#e1f5ff
    style Notifications fill:#e1f5ff
    style Security fill:#e1f5ff

    style Projects fill:#fff4e6
    style Deployments fill:#fff4e6
    style GitOps fill:#fff4e6

    style Auth fill:#f0f9ff
    style Users fill:#f0f9ff
    style Organizations fill:#f0f9ff
```

### 层级职责

| 层级 | 职责 | 依赖 |
|------|------|------|
| **Extension Layer** | 提供AI、监控、通知等扩展功能 | 依赖 Business Layer |
| **Business Layer** | 核心业务逻辑（项目、部署、GitOps） | 依赖 Foundation Layer |
| **Foundation Layer** | 基础服务（认证、用户、组织） | 无外部依赖 |

## 数据流

### 项目创建流程

```mermaid
sequenceDiagram
    actor User
    participant Web
    participant Gateway
    participant ProjectService
    participant Queue
    participant Worker
    participant GitService
    participant FluxService
    participant K8s
    participant SSE

    User->>Web: 创建项目
    Web->>Gateway: tRPC: projects.create()
    
    Gateway->>ProjectService: 验证权限
    ProjectService->>ProjectService: 检查组织成员
    
    ProjectService->>Queue: 添加初始化任务
    Queue-->>ProjectService: 返回 jobId
    ProjectService-->>Gateway: 返回项目 + jobId
    Gateway-->>Web: 项目创建成功
    Web->>SSE: 订阅初始化进度

    Worker->>Queue: 拉取任务
    Worker->>Worker: Step 1: 渲染模板
    Worker->>SSE: 推送进度 20%
    
    Worker->>GitService: Step 2: 创建仓库
    GitService->>GitService: 调用 GitHub API
    Worker->>SSE: 推送进度 40%
    
    Worker->>FluxService: Step 3: 配置 GitOps
    FluxService->>K8s: 创建 GitRepository
    FluxService->>K8s: 创建 Kustomization
    Worker->>SSE: 推送进度 60%
    
    Worker->>Worker: Step 4: 初始化环境
    Worker->>SSE: 推送进度 80%
    
    Worker->>ProjectService: Step 5: 更新状态
    Worker->>SSE: 推送进度 100%
    SSE-->>Web: 初始化完成
    
    Web->>User: 显示成功消息
```

### 部署流程

```mermaid
sequenceDiagram
    actor User
    participant Web
    participant Gateway
    participant DeployService
    participant ApprovalService
    participant FluxService
    participant K8s
    participant Notifications

    User->>Web: 触发部署
    Web->>Gateway: deployments.create()
    
    Gateway->>DeployService: 创建部署
    DeployService->>DeployService: 检查环境状态
    
    alt 需要审批
        DeployService->>ApprovalService: 创建审批请求
        ApprovalService-->>User: 发送审批通知
        User->>ApprovalService: 批准部署
    end
    
    DeployService->>FluxService: 执行 GitOps 部署
    FluxService->>K8s: Apply manifests
    K8s-->>FluxService: 部署状态
    
    FluxService->>DeployService: 更新部署状态
    DeployService->>Notifications: 发送通知
    Notifications-->>User: 部署成功通知
```

### AI 代码审查流程

```mermaid
sequenceDiagram
    actor Developer
    participant Web
    participant Gateway
    participant CodeReviewService
    participant OllamaClient
    participant Ollama

    Developer->>Web: 提交代码审查请求
    Web->>Gateway: aiCodeReview.review()
    
    Gateway->>CodeReviewService: 审查代码
    CodeReviewService->>CodeReviewService: 验证输入
    CodeReviewService->>CodeReviewService: 构建审查提示
    
    CodeReviewService->>OllamaClient: 调用 AI 模型
    OllamaClient->>Ollama: POST /api/chat
    Ollama->>Ollama: 推理（qwen2.5-coder）
    Ollama-->>OllamaClient: 返回审查结果
    
    OllamaClient-->>CodeReviewService: AI 响应
    CodeReviewService->>CodeReviewService: 解析结果
    CodeReviewService->>CodeReviewService: 计算评分
    
    CodeReviewService-->>Gateway: 审查报告
    Gateway-->>Web: 返回结果
    Web->>Developer: 显示问题和建议
```

## 部署架构

### 本地开发环境

```mermaid
graph TB
    subgraph "开发机器"
        Dev[开发者]
        VSCode[VS Code]
        
        subgraph "Bun Runtime"
            WebApp[Web App<br/>:5173]
            APIGateway[API Gateway<br/>:3000]
        end
    end

    subgraph "Docker Compose"
        Postgres[PostgreSQL<br/>:5432]
        Dragonfly[Dragonfly<br/>:6379]
        Ollama[Ollama<br/>:11434]
        GitLab[GitLab CE<br/>:8080]
        Jaeger[Jaeger<br/>:16686]
        Prometheus[Prometheus<br/>:9090]
        Grafana[Grafana<br/>:3000]
    end

    Dev -->|编码| VSCode
    VSCode -->|bun run dev| WebApp
    VSCode -->|bun run dev:api| APIGateway
    
    WebApp -->|HTTP| APIGateway
    APIGateway --> Postgres
    APIGateway --> Dragonfly
    APIGateway --> Ollama
    APIGateway -.->|Traces| Jaeger
    APIGateway -.->|Metrics| Prometheus
```

### 生产环境

```mermaid
graph TB
    subgraph "外部用户"
        Users[用户]
    end

    subgraph "负载均衡层"
        LB[Nginx / Cloudflare]
    end

    subgraph "K3s 集群"
        subgraph "Web 节点"
            Web1[Web Pod 1]
            Web2[Web Pod 2]
        end

        subgraph "API 节点"
            API1[API Pod 1]
            API2[API Pod 2]
            API3[API Pod 3]
        end

        subgraph "Worker 节点"
            Worker1[Worker Pod 1]
            Worker2[Worker Pod 2]
        end

        subgraph "Flux CD"
            Flux[Flux Controller]
        end
    end

    subgraph "数据层"
        DBMaster[(PostgreSQL<br/>Primary)]
        DBReplica[(PostgreSQL<br/>Replica)]
        RedisCluster[Redis Cluster]
    end

    subgraph "存储层"
        S3[MinIO / S3]
    end

    subgraph "监控层"
        OTel[OTel Collector]
        Prom[Prometheus]
        Graf[Grafana]
    end

    Users -->|HTTPS| LB
    LB --> Web1
    LB --> Web2
    
    Web1 -->|API| API1
    Web2 -->|API| API2
    
    API1 --> DBMaster
    API2 --> DBMaster
    API3 --> DBMaster
    
    DBMaster -.->|复制| DBReplica
    
    API1 --> RedisCluster
    Worker1 --> RedisCluster
    Worker2 --> RedisCluster
    
    Worker1 --> S3
    Worker2 --> S3
    
    API1 -.->|Traces| OTel
    API2 -.->|Traces| OTel
    OTel --> Prom
    Prom --> Graf
    
    Flux -.->|GitOps| Web1
    Flux -.->|GitOps| API1
```

## 安全架构

### 认证与授权

```mermaid
graph TB
    User[用户] -->|1. 登录请求| Auth[Auth Service]
    
    Auth -->|2. 验证凭据| DB[(Database)]
    DB -->|3. 用户信息| Auth
    
    Auth -->|4. 生成 JWT| JWT[JWT Token]
    JWT -->|5. 返回 Token| User
    
    User -->|6. 携带 Token| API[API Gateway]
    API -->|7. 验证 Token| Auth
    Auth -->|8. 解析用户信息| API
    
    API -->|9. 检查权限| RBAC[RBAC Service]
    RBAC -->|10. 权限结果| API
    
    alt 有权限
        API -->|11. 执行操作| Service[Business Service]
        Service -->|12. 返回结果| API
    else 无权限
        API -->|403 Forbidden| User
    end
    
    API -->|13. 记录审计日志| Audit[Audit Logs]
```

### 多租户隔离

```mermaid
graph TD
    subgraph "租户 A"
        OrgA[Organization A]
        ProjectA1[Project A1]
        ProjectA2[Project A2]
        MemberA[Members A]
    end

    subgraph "租户 B"
        OrgB[Organization B]
        ProjectB1[Project B1]
        MemberB[Members B]
    end

    subgraph "数据库"
        DB[(PostgreSQL)]
    end

    OrgA -->|organizationId filter| DB
    OrgB -->|organizationId filter| DB
    
    ProjectA1 -.->|属于| OrgA
    ProjectA2 -.->|属于| OrgA
    ProjectB1 -.->|属于| OrgB
    
    MemberA -.->|访问| OrgA
    MemberB -.->|访问| OrgB

    style OrgA fill:#e3f2fd
    style OrgB fill:#f3e5f5
```

### 安全层级

```mermaid
graph LR
    subgraph "网络安全"
        Firewall[防火墙]
        SSL[SSL/TLS]
        WAF[WAF]
    end

    subgraph "应用安全"
        Auth[认证]
        RBAC[RBAC 权限]
        RateLimit[限流]
        CSRF[CSRF 保护]
    end

    subgraph "数据安全"
        Encryption[加密存储]
        Backup[备份]
        Audit[审计日志]
    end

    subgraph "基础设施安全"
        K8s[K8s RBAC]
        Secrets[Secrets 管理]
        NetworkPolicy[Network Policy]
    end

    Firewall --> SSL
    SSL --> WAF
    WAF --> Auth
    Auth --> RBAC
    RBAC --> RateLimit
    RateLimit --> CSRF
    CSRF --> Encryption
    Encryption --> Backup
    Backup --> Audit
    Audit --> K8s
    K8s --> Secrets
    Secrets --> NetworkPolicy
```

## 可观测性架构

### 三大支柱

```mermaid
graph TD
    subgraph "应用层"
        App[应用服务]
    end

    subgraph "Logs 日志"
        Logger[Logger]
        LogStorage[(Log Storage)]
    end

    subgraph "Metrics 指标"
        Metrics[Metrics Exporter]
        Prometheus[(Prometheus)]
    end

    subgraph "Traces 链路追踪"
        Tracer[@Trace Decorator]
        Jaeger[(Jaeger)]
    end

    subgraph "可视化"
        Grafana[Grafana Dashboard]
    end

    App -->|写日志| Logger
    Logger --> LogStorage
    
    App -->|上报指标| Metrics
    Metrics --> Prometheus
    
    App -->|链路追踪| Tracer
    Tracer --> Jaeger
    
    Prometheus --> Grafana
    Jaeger --> Grafana
    LogStorage --> Grafana
```

## 扩展性设计

### 水平扩展

```mermaid
graph TB
    subgraph "Auto Scaling"
        HPA[Horizontal Pod Autoscaler]
    end

    subgraph "应用层"
        direction LR
        API1[API Pod 1]
        API2[API Pod 2]
        API3[API Pod 3]
        APIn[API Pod N]
    end

    subgraph "负载均衡"
        LB[Load Balancer]
    end

    subgraph "数据层"
        direction LR
        DBPrimary[(Primary DB)]
        DBReplica1[(Replica 1)]
        DBReplica2[(Replica 2)]
    end

    HPA -.->|监控 CPU/Memory| API1
    HPA -.->|自动扩缩容| API1

    LB --> API1
    LB --> API2
    LB --> API3
    LB --> APIn

    API1 -->|Write| DBPrimary
    API2 -->|Read| DBReplica1
    API3 -->|Read| DBReplica2

    DBPrimary -.->|复制| DBReplica1
    DBPrimary -.->|复制| DBReplica2
```

## 技术决策记录

### 为什么选择 Bun？

- ⚡ **性能**: 比 Node.js 快 25 倍
- 📦 **内置工具**: 集成包管理、测试、打包
- 🔧 **兼容性**: 完全兼容 Node.js API

### 为什么选择 tRPC？

- 🔒 **类型安全**: 端到端类型推导
- 🚀 **开发体验**: 无需手写 API 文档
- 📉 **减少样板代码**: 自动生成客户端

### 为什么选择 Drizzle ORM？

- 🎯 **TypeScript First**: 原生 TypeScript 支持
- 🏃 **性能优异**: 比 Prisma 快 2-3 倍
- 🔍 **SQL-like API**: 熟悉的 SQL 语法

### 为什么选择 K3s + Flux CD？

- 🪶 **轻量级**: K3s 资源占用小
- 🔄 **GitOps**: Flux CD 声明式部署
- 📦 **易于管理**: 自动同步 Git 仓库

## 性能优化策略

### 数据库优化

- ✅ 使用索引优化查询
- ✅ 读写分离（主从复制）
- ✅ 连接池管理
- ✅ 查询缓存

### 缓存策略

- ✅ Redis 缓存热点数据
- ✅ API 响应缓存
- ✅ 静态资源 CDN

### 前端优化

- ✅ 代码分割（懒加载）
- ✅ Tree Shaking
- ✅ 资源压缩
- ✅ PWA 离线支持

## 参考资料

- [错误处理指南](./ERROR_HANDLING_GUIDE.md)
- [API 文档指南](./API_DOCUMENTATION_GUIDE.md)
- [AI 代码审查指南](./AI_CODE_REVIEW_GUIDE.md)
- [项目 README](../README.md)
