# 🗺️ 技术路线图

## 当前版本: v1.0 (核心功能)

**状态**: ✅ 已完成  
**发布时间**: 2025-01-XX

### 已实现功能
- ✅ 完整的认证授权系统
- ✅ 组织/团队/项目管理
- ✅ 仓库集成 (GitHub/GitLab)
- ✅ CI/CD Pipeline
- ✅ 部署管理和审批
- ✅ 成本追踪和告警
- ✅ 安全策略引擎
- ✅ 审计日志系统
- ✅ AI 助手 (Ollama)
- ✅ 对象存储 (MinIO)

---

## v1.1 (容器编排) - 计划中

**目标**: 集成 K3s 轻量级 Kubernetes  
**预计时间**: 2-3 周

### 核心功能
- [ ] K3s 客户端集成
- [ ] 部署到 K3s 集群
- [ ] Pod/Service 管理
- [ ] 资源监控
- [ ] 日志收集

### 技术选型
```typescript
// 使用 @kubernetes/client-node
import * as k8s from '@kubernetes/client-node'

// K3s 配置
const kc = new k8s.KubeConfig()
kc.loadFromFile('/path/to/kubeconfig')
```

### 数据库变更
```sql
-- 添加 k8s_deployments 表
CREATE TABLE k8s_deployments (
  id UUID PRIMARY KEY,
  deployment_id UUID REFERENCES deployments(id),
  cluster_name VARCHAR(255),
  namespace VARCHAR(255),
  manifest JSONB,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## v1.2 (任务队列) - 计划中

**目标**: 集成 BullMQ 分布式任务队列  
**预计时间**: 1-2 周

### 核心功能
- [ ] BullMQ 队列配置
- [ ] Pipeline 异步执行
- [ ] 任务重试机制
- [ ] 任务优先级
- [ ] 任务监控面板

### 技术选型
```typescript
// 使用 BullMQ
import { Queue, Worker } from 'bullmq'

// Pipeline 队列
const pipelineQueue = new Queue('pipeline', {
  connection: redisConnection
})

// Pipeline Worker
const worker = new Worker('pipeline', async (job) => {
  await executePipeline(job.data)
}, { connection: redisConnection })
```

### 架构变更
```
Before:
API → PipelineService → 直接执行

After:
API → PipelineService → BullMQ Queue → Worker → 执行
```

---

## v1.3 (实时功能) - 规划中

**目标**: WebSocket 实时日志和通知  
**预计时间**: 2 周

### 核心功能
- [ ] WebSocket 服务器
- [ ] 实时日志流
- [ ] 实时通知推送
- [ ] 实时状态更新
- [ ] 连接管理

### 技术选型
```typescript
// 使用 @nestjs/websockets
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server } from 'socket.io'

@WebSocketGateway()
export class LogsGateway {
  @WebSocketServer()
  server: Server

  streamLogs(pipelineRunId: string) {
    // 流式推送日志
  }
}
```

---

## v1.4 (测试和质量) - 规划中

**目标**: 完善测试覆盖率  
**预计时间**: 3-4 周

### 核心功能
- [ ] 单元测试 (覆盖率 > 80%)
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 性能测试
- [ ] 安全测试

### 技术选型
```typescript
// 使用 Vitest
import { describe, it, expect } from 'vitest'

describe('AuthService', () => {
  it('should create session', async () => {
    const session = await authService.createSession('user-id')
    expect(session).toBeDefined()
  })
})
```

---

## v2.0 (多云支持) - 远期规划

**目标**: 支持多云部署  
**预计时间**: 2-3 个月

### 核心功能
- [ ] AWS 集成
- [ ] Azure 集成
- [ ] GCP 集成
- [ ] 多云成本对比
- [ ] 多云部署策略

---

## v2.1 (微服务) - 远期规划

**目标**: 微服务架构拆分  
**预计时间**: 3-4 个月

### 服务拆分
```
Monolith → Microservices

- auth-service (认证服务)
- org-service (组织服务)
- pipeline-service (Pipeline 服务)
- deployment-service (部署服务)
- notification-service (通知服务)
- ai-service (AI 服务)
```

---

## 技术债务

### 需要优化
1. **性能优化**
   - 数据库查询优化
   - 缓存策略优化
   - API 响应时间优化

2. **代码质量**
   - 增加单元测试
   - 代码重构
   - 文档完善

3. **安全加固**
   - 安全审计
   - 漏洞扫描
   - 依赖更新

---

## 技术选型原则

### 优先考虑
1. **性能** - 选择高性能的技术
2. **类型安全** - 优先 TypeScript 生态
3. **社区活跃** - 选择活跃维护的项目
4. **易于集成** - 与现有技术栈兼容

### 当前技术栈
- ✅ Bun (运行时)
- ✅ NestJS 11 (框架)
- ✅ tRPC 11 (API)
- ✅ Drizzle (ORM)
- ✅ PostgreSQL 17 (数据库)
- ✅ Dragonfly (缓存)
- ✅ MinIO (存储)
- ✅ Ollama (AI)

### 计划引入
- 🔜 @kubernetes/client-node (K3s)
- 🔜 BullMQ (任务队列)
- 🔜 Socket.IO (WebSocket)
- 🔜 Vitest (测试)

---

## 版本发布计划

| 版本 | 功能 | 状态 | 预计时间 |
|------|------|------|----------|
| v1.0 | 核心功能 | ✅ 完成 | 已发布 |
| v1.1 | K3s 集成 | 🔜 计划中 | 2-3 周 |
| v1.2 | BullMQ 队列 | 🔜 计划中 | 1-2 周 |
| v1.3 | 实时功能 | 📋 规划中 | 2 周 |
| v1.4 | 测试完善 | 📋 规划中 | 3-4 周 |
| v2.0 | 多云支持 | 💡 远期 | 2-3 月 |
| v2.1 | 微服务 | 💡 远期 | 3-4 月 |

---

## 贡献指南

### 如何参与
1. 查看 [TODO.md](./TODO.md) 了解待办事项
2. 选择感兴趣的功能
3. 创建 Feature Branch
4. 提交 Pull Request

### 开发规范
- 遵循 TypeScript 规范
- 编写单元测试
- 更新文档
- 代码审查

---

**最后更新**: 2025-01-XX
