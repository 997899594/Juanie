# 架构重构快速参考

> 这是 `ARCHITECTURE-REFACTORING-MASTER-PLAN.md` 的精简版，用于快速查阅

---

## 🎯 核心目标

1. **K8s/Flux → Core 层** - 基础设施不应该在 Business 层
2. **Git 凭证统一 → Foundation 层** - 删除重复的 credentials 和 git-providers
3. **修复分层违规** - Business 层不再直接查询 Foundation 层的表（18+ 处）
4. **简化抽象** - 删除不必要的 EventsService
5. **Worker 独立化** - 移到独立的 workers 包

---

## 📦 重构后的包结构

### Core 层（纯基础设施）
```
packages/core/src/
├── k8s/              # ✅ 新增 - 使用 @kubernetes/client-node
├── flux/             # ✅ 新增 - Flux CLI 封装
├── database/
├── redis/
├── queue/
├── events/
├── encryption/
└── ...
```

### Foundation 层（基础业务能力）
```
packages/services/foundation/src/
├── git-connections/  # ✅ 扩展 - 统一所有 Git 凭证管理
│   ├── git-connections.service.ts
│   ├── git-api.service.ts  # ✅ 新增
│   └── credential-resolver.ts  # ✅ 新增
├── organizations/    # ✅ 扩展 - 新增方法
│   └── organizations.service.ts  # exists(), getMember(), isAdmin()
├── teams/            # ✅ 扩展 - 新增方法
│   └── teams.service.ts  # exists(), get(), hasProjectAccess()
└── ...
```

### Business 层（核心业务逻辑）
```
packages/services/business/src/
├── projects/         # ✅ 修改 - 使用 Foundation 服务
├── deployments/      # ✅ 修改 - 使用 Foundation 服务
├── repositories/     # ✅ 修改 - 使用 Foundation 服务
└── gitops/
    ├── git-sync/     # ✅ 保留 - 业务逻辑
    └── webhooks/     # ✅ 保留 - 业务逻辑
```

### Workers 包（独立部署）
```
packages/workers/
├── project-initialization/
└── git-sync/
```

---

## 🔧 关键修改模式

### 1. Business 层使用 Foundation 层

```typescript
// ❌ 错误 - 直接查询数据库
const [orgMember] = await this.db
  .select()
  .from(schema.organizationMembers)
  .where(...)

// ✅ 正确 - 通过 Foundation 层
const orgMember = await this.organizationsService.getMember(
  organizationId, 
  userId
)
```

### 2. 统一 Git 凭证管理

```typescript
// ❌ 错误 - 使用 CredentialManagerService
const credential = await this.credentialManager.getProjectCredential(projectId)

// ✅ 正确 - 使用 GitConnectionsService
const credentials = await this.gitConnections.resolveCredentials(
  userId, 
  'github'
)
```

### 3. 使用 Core 层的 K8s 服务

```typescript
// ❌ 错误 - 从 Business 层导入
import { K3sService } from '../gitops/k3s/k3s.service'

// ✅ 正确 - 从 Core 层导入
import { K8sService } from '@juanie/core/k8s'
```

### 4. 直接发布事件

```typescript
// ❌ 错误 - 使用专门的 EventsService
await this.organizationEvents.emitOrganizationCreated(...)

// ✅ 正确 - 直接发布
this.eventEmitter.emit(DomainEvents.ORGANIZATION_CREATED, {
  organizationId: org.id,
  name: org.name,
})
```

---

## 📋 每日检查清单

### 开始工作前
- [ ] 拉取最新代码
- [ ] 运行 `bun install`
- [ ] 运行 `bun run type-check` 确认基线

### 完成修改后
- [ ] 运行 `bun run type-check`
- [ ] 运行 `bun test`
- [ ] 运行 `biome check --write`
- [ ] 提交代码

### 每天结束时
- [ ] 更新进度文档
- [ ] 记录遇到的问题
- [ ] 计划明天的任务

---

## 🚨 常见问题

### Q: 如何判断代码应该放在哪一层？

**Core 层**: 纯技术基础设施，无业务逻辑（数据库、Redis、K8s、Flux）  
**Foundation 层**: 基础业务能力，可复用（用户、组织、团队、Git 连接）  
**Business 层**: 核心业务逻辑，特定于应用（项目、部署、GitOps）

### Q: 如何处理循环依赖？

**原则**: 依赖只能单向  
**方向**: Business → Foundation → Core  
**解决**: 如果出现循环依赖，说明分层有问题，需要重新设计

### Q: 测试失败怎么办？

1. 检查是否正确注入了 Foundation 服务
2. 检查 mock 是否正确
3. 检查是否有遗漏的数据库查询
4. 运行 `bun run type-check` 查看类型错误

---

## 📞 需要帮助？

- 查看完整计划: `docs/architecture/ARCHITECTURE-REFACTORING-MASTER-PLAN.md`
- 查看分层违规详情: `docs/architecture/layered-architecture-violations.md`
- 查看严重问题分析: `docs/architecture/CRITICAL-ARCHITECTURE-VIOLATIONS.md`

