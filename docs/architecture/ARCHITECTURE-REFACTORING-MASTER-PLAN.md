# 🚨 架构重构总体规划

> **状态**: 🔴 待执行  
> **优先级**: P0 (最高)  
> **预计时间**: 2-3 周  
> **影响范围**: Foundation 层 + Business 层

---

## 📋 执行概览

本文档是 Foundation 和 Business 层架构重构的**总体规划**，整合了所有已识别的问题和解决方案。

**关键原则**:
1. **严格分层** - Business → Foundation → Core，绝不跨层
2. **使用成熟工具** - 不重复造轮子
3. **删除冗余** - 不保留向后兼容，直接替换
4. **职责清晰** - 每层只做自己该做的事

---

## 🔴 P0 - 立即修复（第 1 周）

### 1. 移动基础设施代码到 Core 层

#### 1.1 K3s 客户端 → Core

**当前位置**: `packages/services/business/src/gitops/k3s/`

**问题**:
- K3s 连接是基础设施，不是业务逻辑
- 自定义 K8s 客户端违反"使用成熟工具"原则
- Business 层不应该包含基础设施代码

**解决方案**:
```
移动到: packages/core/src/k8s/
├── k8s.module.ts          # K8s 模块
├── k8s-client.service.ts  # 使用 @kubernetes/client-node
└── index.ts
```

**迁移步骤**:
1. 安装 `@kubernetes/client-node`
2. 创建 `packages/core/src/k8s/` 目录
3. 重写 K8sService，使用官方客户端
4. 更新所有引用（Business 层从 Core 导入）
5. 删除 `packages/services/business/src/gitops/k3s/`


#### 1.2 Flux CLI → Core

**当前位置**: `packages/services/business/src/gitops/flux/`

**问题**:
- Flux 是基础设施工具，不是业务逻辑
- CLI 封装是技术细节
- 与 K3s 强耦合，但 K3s 也在错误的层

**解决方案**:
```
移动到: packages/core/src/flux/
├── flux.module.ts         # Flux 模块
├── flux-cli.service.ts    # CLI 封装
├── flux-watcher.service.ts
└── index.ts
```

**迁移步骤**:
1. 创建 `packages/core/src/flux/` 目录
2. 移动 Flux 相关服务到 Core
3. 更新依赖（依赖 Core 的 K8s 模块）
4. 更新所有引用
5. 删除 `packages/services/business/src/gitops/flux/`

---

### 2. 统一 Git 凭证管理到 Foundation 层

#### 2.1 合并 Credentials 到 git-connections

**当前问题**:
- Business 层有: `gitops/credentials/` (credential-factory, credential-manager, oauth-credential, pat-credential, github-app-credential)
- Foundation 层有: `git-connections/git-connections.service.ts`
- **职责重复**: 两个地方都管理 Git 凭证
- **加密逻辑重复**: 每个服务都管理自己的加密密钥

**解决方案**: 统一到 Foundation 层的 `git-connections`

```
packages/services/foundation/src/git-connections/
├── git-connections.service.ts     # 统一管理所有 Git 连接
├── credential-types.ts            # 凭证类型定义 (OAuth, PAT, GitHub App)
├── credential-resolver.ts         # 凭证解析器
└── index.ts
```

**迁移步骤**:
1. 扩展 `GitConnectionsService`，支持所有凭证类型
2. 添加 `resolveCredentials()` 方法（统一入口）
3. 更新 Business 层所有服务，使用 `GitConnectionsService`
4. 删除 `packages/services/business/src/gitops/credentials/`


#### 2.2 合并 git-providers 到 Foundation 层

**当前位置**: `packages/services/business/src/gitops/git-providers/`

**问题**:
- Git Provider API 调用是基础能力，不是业务逻辑
- 与 git-connections 职责重叠

**解决方案**:
```
packages/services/foundation/src/git-connections/
├── git-connections.service.ts     # 管理 OAuth 连接和凭证
├── git-api.service.ts             # 封装 GitHub/GitLab API 调用
└── index.ts
```

**职责划分**:
- `git-connections.service.ts`: 管理用户的 Git 连接（OAuth、Token）
- `git-api.service.ts`: 封装 Git 平台 API 调用（创建仓库、Webhook 等）

**迁移步骤**:
1. 创建 `git-api.service.ts`
2. 移动 API 调用逻辑到 Foundation 层
3. 更新 Business 层引用
4. 删除 `packages/services/business/src/gitops/git-providers/`

---

### 3. 修复分层违规（Business 绕过 Foundation）

#### 3.1 完善 Foundation 层服务

**问题**: Business 层直接查询 Foundation 层的表（18+ 处违规）

**解决方案**: 在 Foundation 层添加缺失的方法

##### OrganizationsService 新增方法

```typescript
// packages/services/foundation/src/organizations/organizations.service.ts

@Injectable()
export class OrganizationsService {
  // ✅ 新增: 检查组织是否存在
  async exists(organizationId: string): Promise<boolean>
  
  // ✅ 新增: 获取组织成员
  async getMember(organizationId: string, userId: string): Promise<OrganizationMember | null>
  
  // ✅ 新增: 检查用户是否是组织管理员
  async isAdmin(organizationId: string, userId: string): Promise<boolean>
  
  // ✅ 新增: 获取组织的所有管理员
  async getAdmins(organizationId: string): Promise<OrganizationMember[]>
  
  // ✅ 新增: 批量检查成员权限
  async checkMemberPermissions(
    organizationId: string, 
    userId: string
  ): Promise<{ isMember: boolean; isAdmin: boolean; role: string | null }>
}
```


##### TeamsService 新增方法

```typescript
// packages/services/foundation/src/teams/teams.service.ts

@Injectable()
export class TeamsService {
  // ✅ 新增: 检查团队是否存在
  async exists(teamId: string): Promise<boolean>
  
  // ✅ 新增: 获取团队详情
  async get(teamId: string): Promise<Team | null>
  
  // ✅ 新增: 检查用户是否是团队成员
  async isMember(teamId: string, userId: string): Promise<boolean>
  
  // ✅ 新增: 检查用户是否通过团队访问项目
  async hasProjectAccess(userId: string, projectId: string): Promise<boolean>
  
  // ✅ 新增: 获取用户在团队中的角色
  async getMemberRole(teamId: string, userId: string): Promise<string | null>
}
```

#### 3.2 修改 Business 层使用 Foundation 层

**影响的服务**:
- ProjectsService (6+ 处违规)
- DeploymentsService (3 处违规)
- RepositoriesService (5 处违规)
- PipelinesService (2 处违规)
- EnvironmentsService (1+ 处违规)

**修改模式**:

```typescript
// ❌ 错误 - 直接查询数据库
const [orgMember] = await this.db
  .select()
  .from(schema.organizationMembers)
  .where(...)

// ✅ 正确 - 通过 Foundation 层
const orgMember = await this.organizationsService.getMember(organizationId, userId)
```

**迁移步骤**:
1. 在所有 Business 服务中注入 `OrganizationsService` 和 `TeamsService`
2. 替换所有直接数据库查询
3. 删除私有辅助方法（如 `getOrgMember()`）
4. 运行测试验证

---

### 4. 修复模块导入错误

**问题**: 多个模块从错误的包导入 `DatabaseModule`

```typescript
// ❌ 错误
import { DatabaseModule } from '@juanie/database'

// ✅ 正确
import { DatabaseModule } from '@juanie/core/database'
```

**影响范围**:
- Foundation 层多个模块
- Business 层多个模块

**修复步骤**:
1. 全局搜索 `from '@juanie/database'`
2. 替换为 `from '@juanie/core/database'`
3. 验证类型检查通过


---

## 🟡 P1 - 高优先级（第 2 周）

### 5. 简化事件发布

**问题**: 专门的 EventsService 是不必要的抽象

**当前**:
```typescript
// ❌ 不必要的抽象
export class OrganizationEventsService {
  async emitOrganizationCreated(event: OrganizationCreatedEvent) {
    this.eventEmitter.emit(DomainEvents.ORGANIZATION_CREATED, event)
  }
}
```

**解决方案**: 直接在主服务中发布事件

```typescript
// ✅ 简洁明了
export class OrganizationsService {
  async createOrganization(data: CreateOrganizationInput) {
    const org = await this.db.insert(schema.organizations).values(data).returning()
    
    this.eventEmitter.emit(DomainEvents.ORGANIZATION_CREATED, {
      organizationId: org.id,
      name: org.name,
    })
    
    return org
  }
}
```

**迁移步骤**:
1. 识别所有 `*-events.service.ts` 文件
2. 将事件发布逻辑移到主服务
3. 删除 EventsService 文件
4. 更新依赖注入

---

### 6. Worker 独立化

**问题**: Worker 在 Business 层，应该独立或移到 Core

**当前位置**:
- `packages/services/business/src/queue/project-initialization.worker.ts`
- `packages/services/business/src/gitops/git-sync/git-sync.worker.ts`

**方案 A: 独立 workers 包（推荐）**

```
packages/workers/
├── project-initialization/
│   ├── worker.ts
│   └── handlers/
├── git-sync/
│   ├── worker.ts
│   └── handlers/
└── package.json
```

**方案 B: 移到 Core 层**

```
packages/core/src/queue/
├── workers/
│   ├── base-worker.ts
│   └── worker-factory.ts
└── queue.module.ts
```

**决策**: 采用方案 A（独立包），因为：
- Worker 可以独立部署
- 更好的关注点分离
- 更容易扩展

**迁移步骤**:
1. 创建 `packages/workers/` 目录
2. 移动 Worker 代码
3. 更新 package.json 依赖
4. 更新部署配置
5. 删除 Business 层的 Worker 代码


---

## 🟢 P2 - 中优先级（第 3 周）

### 7. 清理历史遗留

#### 7.1 删除空的 encryption 目录

**位置**: `packages/services/foundation/src/encryption/` (空目录)

**问题**: 加密已经在 Core 层，空目录造成困惑

**解决方案**: 直接删除

```bash
rm -rf packages/services/foundation/src/encryption/
```

#### 7.2 清理未使用的代码

**检查项**:
- 未使用的导入
- 未使用的方法
- 注释掉的代码
- 临时调试代码

**工具**: 使用 Biome 检查

```bash
biome check --write
```

---

## 📊 重构后的架构

### Core 层（纯基础设施）

```
packages/core/src/
├── database/          # ✅ 数据库连接
├── redis/             # ✅ Redis 连接
├── queue/             # ✅ BullMQ 队列
├── events/            # ✅ EventEmitter2
├── encryption/        # ✅ 加密纯函数
├── k8s/              # ✅ K8s 客户端 (新增)
│   ├── k8s.module.ts
│   ├── k8s-client.service.ts  # 使用 @kubernetes/client-node
│   └── index.ts
├── flux/             # ✅ Flux CLI (新增)
│   ├── flux.module.ts
│   ├── flux-cli.service.ts
│   └── index.ts
├── observability/     # ✅ OpenTelemetry
├── errors/            # ✅ 错误基类
└── utils/             # ✅ 工具函数
```

### Foundation 层（基础业务能力）

```
packages/services/foundation/src/
├── auth/              # ✅ 认证
├── users/             # ✅ 用户管理
├── organizations/     # ✅ 组织管理 (扩展方法)
│   └── organizations.service.ts  # 新增: exists(), getMember(), isAdmin(), getAdmins()
├── teams/             # ✅ 团队管理 (扩展方法)
│   └── teams.service.ts  # 新增: exists(), get(), isMember(), hasProjectAccess()
├── git-connections/   # ✅ Git 连接管理 (统一所有凭证)
│   ├── git-connections.service.ts  # 管理 OAuth、PAT、GitHub App
│   ├── git-api.service.ts          # 封装 GitHub/GitLab API (新增)
│   ├── credential-types.ts         # 凭证类型定义 (新增)
│   └── credential-resolver.ts      # 凭证解析器 (新增)
├── storage/           # ✅ 对象存储
├── notifications/     # ✅ 通知
├── sessions/          # ✅ 会话
└── rate-limit/        # ✅ 速率限制
```

### Business 层（核心业务逻辑）

```
packages/services/business/src/
├── projects/          # ✅ 项目管理 (使用 Foundation 服务)
├── environments/      # ✅ 环境管理
├── deployments/       # ✅ 部署管理
├── repositories/      # ✅ 仓库管理
├── templates/         # ✅ 模板管理
├── pipelines/         # ✅ 流水线
└── gitops/            # ✅ GitOps 业务逻辑 (不包含基础设施)
    ├── git-sync/      # ✅ Git 同步业务逻辑
    └── webhooks/      # ✅ Webhook 处理
```

### Workers 包（独立部署）

```
packages/workers/
├── project-initialization/
│   ├── worker.ts
│   └── handlers/
├── git-sync/
│   ├── worker.ts
│   └── handlers/
└── package.json
```


---

## 📋 详细执行清单

### Week 1: P0 - 基础设施和分层修复

#### Day 1-2: K8s 和 Flux 迁移

- [ ] 安装 `@kubernetes/client-node`
- [ ] 创建 `packages/core/src/k8s/`
  - [ ] `k8s.module.ts`
  - [ ] `k8s-client.service.ts` (使用官方客户端)
  - [ ] `index.ts`
- [ ] 创建 `packages/core/src/flux/`
  - [ ] `flux.module.ts`
  - [ ] `flux-cli.service.ts`
  - [ ] `flux-watcher.service.ts`
  - [ ] `index.ts`
- [ ] 更新 `packages/core/package.json` 导出
- [ ] 更新 Business 层所有引用
- [ ] 删除 `packages/services/business/src/gitops/k3s/`
- [ ] 删除 `packages/services/business/src/gitops/flux/`
- [ ] 运行类型检查: `bun run type-check`

#### Day 3-4: Git 凭证统一

- [ ] 扩展 `GitConnectionsService`
  - [ ] 添加 `resolveCredentials()` 方法
  - [ ] 添加 `resolveRepositoryConfig()` 方法
  - [ ] 支持所有凭证类型 (OAuth, PAT, GitHub App)
- [ ] 创建 `git-api.service.ts`
  - [ ] 封装 GitHub API 调用
  - [ ] 封装 GitLab API 调用
- [ ] 更新 Business 层所有服务
  - [ ] CredentialManagerService → GitConnectionsService
  - [ ] GitProviderService → GitApiService
- [ ] 删除 `packages/services/business/src/gitops/credentials/`
- [ ] 删除 `packages/services/business/src/gitops/git-providers/`
- [ ] 运行类型检查

#### Day 5: 完善 Foundation 层服务

- [ ] 扩展 `OrganizationsService`
  - [ ] `exists(organizationId): Promise<boolean>`
  - [ ] `getMember(organizationId, userId): Promise<OrganizationMember | null>`
  - [ ] `isAdmin(organizationId, userId): Promise<boolean>`
  - [ ] `getAdmins(organizationId): Promise<OrganizationMember[]>`
  - [ ] `checkMemberPermissions(organizationId, userId)`
- [ ] 扩展 `TeamsService`
  - [ ] `exists(teamId): Promise<boolean>`
  - [ ] `get(teamId): Promise<Team | null>`
  - [ ] `isMember(teamId, userId): Promise<boolean>`
  - [ ] `hasProjectAccess(userId, projectId): Promise<boolean>`
  - [ ] `getMemberRole(teamId, userId): Promise<string | null>`
- [ ] 添加单元测试
- [ ] 运行测试: `bun test`


#### Day 6-7: 修复 Business 层分层违规

- [ ] **ProjectsService** (6+ 处违规)
  - [ ] 注入 `OrganizationsService`, `TeamsService`
  - [ ] 替换 `getOrgMember()` → `organizationsService.getMember()`
  - [ ] 替换所有直接 DB 查询
  - [ ] 删除私有辅助方法
  - [ ] 更新测试
  
- [ ] **DeploymentsService** (3 处违规)
  - [ ] 注入 `OrganizationsService`
  - [ ] 替换 3 处 `organizationMembers` 查询
  - [ ] 更新测试
  
- [ ] **RepositoriesService** (5 处违规)
  - [ ] 注入 `OrganizationsService`
  - [ ] 替换 5 处 `organizationMembers` 查询
  - [ ] 更新测试
  
- [ ] **PipelinesService** (2 处违规)
  - [ ] 注入 `OrganizationsService`
  - [ ] 替换 2 处 `organizationMembers` 查询
  - [ ] 更新测试
  
- [ ] **EnvironmentsService** (1+ 处违规)
  - [ ] 注入 `OrganizationsService`
  - [ ] 替换 1 处 `organizationMembers` 查询
  - [ ] 更新测试

- [ ] **ProjectMembersService** (1 处违规)
  - [ ] 注入 `TeamsService`
  - [ ] 替换 1 处 `teamMembers` 查询
  - [ ] 更新测试

- [ ] 运行所有测试: `bun test`
- [ ] 运行类型检查: `bun run type-check`

---

### Week 2: P1 - 简化和优化

#### Day 8-9: 简化事件发布

- [ ] 识别所有 `*-events.service.ts` 文件
  - [ ] `organization-events.service.ts`
  - [ ] 其他类似文件
- [ ] 将事件发布逻辑移到主服务
- [ ] 删除 EventsService 文件
- [ ] 更新依赖注入
- [ ] 更新测试
- [ ] 运行测试: `bun test`

#### Day 10-11: Worker 独立化

- [ ] 创建 `packages/workers/` 目录
- [ ] 创建 `packages/workers/package.json`
- [ ] 移动 `project-initialization.worker.ts`
  - [ ] 创建 `packages/workers/project-initialization/`
  - [ ] 移动 worker 代码
  - [ ] 更新依赖
- [ ] 移动 `git-sync.worker.ts`
  - [ ] 创建 `packages/workers/git-sync/`
  - [ ] 移动 worker 代码
  - [ ] 更新依赖
- [ ] 更新根 `package.json` workspaces
- [ ] 更新 `turbo.json` 配置
- [ ] 删除 Business 层的 Worker 代码
- [ ] 更新部署配置
- [ ] 测试 Worker 独立运行

#### Day 12: 修复模块导入错误

- [ ] 全局搜索 `from '@juanie/database'`
- [ ] 替换为 `from '@juanie/core/database'`
- [ ] 全局搜索 `from '@juanie/events'`
- [ ] 替换为 `from '@juanie/core/events'`
- [ ] 运行类型检查: `bun run type-check`
- [ ] 运行所有测试: `bun test`


---

### Week 3: P2 - 清理和验证

#### Day 13-14: 清理历史遗留

- [ ] 删除空的 encryption 目录
  ```bash
  rm -rf packages/services/foundation/src/encryption/
  ```
- [ ] 运行 Biome 检查
  ```bash
  biome check --write
  ```
- [ ] 清理未使用的导入
- [ ] 清理未使用的方法
- [ ] 清理注释掉的代码
- [ ] 清理临时调试代码

#### Day 15: 全面测试和验证

- [ ] 运行所有单元测试
  ```bash
  bun test
  ```
- [ ] 运行类型检查
  ```bash
  bun run type-check
  ```
- [ ] 运行 Monorepo 健康检查
  ```bash
  bun run health
  ```
- [ ] 手动测试关键功能
  - [ ] 项目创建
  - [ ] 项目初始化
  - [ ] 部署触发
  - [ ] Git 同步
  - [ ] GitOps 资源创建

#### Day 16-17: 文档更新

- [ ] 更新架构文档
  - [ ] `docs/architecture/layered-architecture.md`
  - [ ] `docs/architecture/core-layer.md`
  - [ ] `docs/architecture/foundation-layer.md`
  - [ ] `docs/architecture/business-layer.md`
- [ ] 更新导入指南
  - [ ] `docs/guides/import-guide.md`
- [ ] 更新开发指南
  - [ ] `docs/guides/development-guide.md`
- [ ] 创建迁移指南
  - [ ] `docs/guides/architecture-migration-guide.md`

#### Day 18: Code Review 和总结

- [ ] Code Review
  - [ ] 检查所有修改
  - [ ] 确认分层正确
  - [ ] 确认没有遗漏
- [ ] 创建总结报告
  - [ ] 修改统计
  - [ ] 问题修复清单
  - [ ] 性能对比
  - [ ] 下一步计划
- [ ] 团队分享

---

## 📈 预期收益

### 代码质量

- ✅ **减少重复代码**: 18+ 处违规 → 0 处
- ✅ **Business 层代码减少**: 约 500-800 行
- ✅ **Foundation 层代码增加**: 约 200-300 行（新增方法）
- ✅ **Core 层代码增加**: 约 300-400 行（K8s, Flux）

### 可维护性

- ✅ **分层清晰**: 严格遵守 Business → Foundation → Core
- ✅ **职责明确**: 每层只做自己该做的事
- ✅ **依赖清晰**: 单向依赖，无循环依赖
- ✅ **易于扩展**: 新功能知道放在哪一层

### 可测试性

- ✅ **Business 层测试简化**: 只需 mock Foundation 服务
- ✅ **Foundation 层测试独立**: 不依赖 Business 层
- ✅ **Core 层测试纯粹**: 纯基础设施测试

### 性能

- ✅ **减少重复查询**: 统一的 Foundation 层方法可以优化缓存
- ✅ **更好的缓存策略**: Foundation 层统一管理缓存
- ✅ **减少数据库连接**: 避免重复查询


---

## 🚨 风险和缓解措施

### 风险 1: 大规模重构导致功能回归

**缓解措施**:
- ✅ 每个阶段都运行完整测试
- ✅ 保持小步快跑，每天提交
- ✅ 使用 Git 分支，随时可以回滚
- ✅ 关键功能手动测试

### 风险 2: 依赖关系复杂，可能遗漏

**缓解措施**:
- ✅ 使用 TypeScript 类型检查
- ✅ 使用 `bun run health` 检查 Monorepo 健康
- ✅ 使用 Biome 检查未使用的导入
- ✅ Code Review 仔细检查

### 风险 3: Worker 独立化可能影响部署

**缓解措施**:
- ✅ 先在开发环境测试
- ✅ 更新部署文档
- ✅ 保持向后兼容（过渡期）
- ✅ 逐步迁移，不一次性切换

### 风险 4: 时间估算不准确

**缓解措施**:
- ✅ 按优先级执行，P0 必须完成
- ✅ P1 和 P2 可以延后
- ✅ 每天记录进度
- ✅ 及时调整计划

---

## 📝 进度跟踪

### Week 1 进度

| Day | 任务 | 状态 | 备注 |
|-----|------|------|------|
| 1-2 | K8s 和 Flux 迁移 | ⏳ 待开始 | |
| 3-4 | Git 凭证统一 | ⏳ 待开始 | |
| 5 | 完善 Foundation 层 | ⏳ 待开始 | |
| 6-7 | 修复 Business 层违规 | ⏳ 待开始 | |

### Week 2 进度

| Day | 任务 | 状态 | 备注 |
|-----|------|------|------|
| 8-9 | 简化事件发布 | ⏳ 待开始 | |
| 10-11 | Worker 独立化 | ⏳ 待开始 | |
| 12 | 修复模块导入 | ⏳ 待开始 | |

### Week 3 进度

| Day | 任务 | 状态 | 备注 |
|-----|------|------|------|
| 13-14 | 清理历史遗留 | ⏳ 待开始 | |
| 15 | 全面测试验证 | ⏳ 待开始 | |
| 16-17 | 文档更新 | ⏳ 待开始 | |
| 18 | Code Review 总结 | ⏳ 待开始 | |

---

## 🎯 成功标准

### 必须达成（P0）

- ✅ K8s 和 Flux 移到 Core 层
- ✅ Git 凭证管理统一到 Foundation 层
- ✅ Business 层不再直接查询 Foundation 层的表（0 处违规）
- ✅ 所有模块导入正确
- ✅ 所有测试通过
- ✅ 类型检查通过

### 期望达成（P1）

- ✅ 删除不必要的 EventsService
- ✅ Worker 独立化
- ✅ 代码减少 500+ 行

### 可选达成（P2）

- ✅ 清理所有历史遗留
- ✅ 文档完整更新
- ✅ 性能优化（缓存策略）

---

## 📚 参考文档

### 问题分析

- `docs/architecture/layered-architecture-violations.md` - 18+ 处分层违规详情
- `docs/architecture/CRITICAL-ARCHITECTURE-VIOLATIONS.md` - 严重架构问题总结
- `docs/architecture/foundation-layer-architecture-analysis.md` - Foundation 层分析

### 架构设计

- `docs/architecture/core-package-design-review.md` - Core 层设计评审
- `docs/architecture/CORE_REFACTORING_DONE.md` - Core 层重构完成报告
- `docs/guides/layered-architecture-enforcement.md` - 分层架构执行指南

### 开发指南

- `docs/guides/monorepo-best-practices.md` - Monorepo 最佳实践
- `.kiro/steering/project-guide.md` - 项目指南

---

## 🤝 协作方式

### 每日站会

- 汇报昨天完成的任务
- 今天计划的任务
- 遇到的问题和阻塞

### Code Review

- 每个 PR 必须经过 Review
- 重点检查分层是否正确
- 重点检查是否有遗漏

### 问题反馈

- 及时在文档中记录问题
- 及时调整计划
- 及时沟通

---

## ✅ 下一步行动

1. **Review 本文档** - 确认计划合理
2. **创建 Git 分支** - `feature/architecture-refactoring`
3. **开始 Day 1-2 任务** - K8s 和 Flux 迁移
4. **每天更新进度** - 在本文档中记录

---

**最后更新**: 2024-12-24  
**状态**: 🔴 待执行  
**负责人**: 架构团队  
**预计完成**: 2025-01-14

