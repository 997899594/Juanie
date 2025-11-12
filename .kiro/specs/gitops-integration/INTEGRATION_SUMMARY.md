# GitOps 集成 - 系统集成总结

## 设计理念

本 GitOps 集成方案完全基于现有 AI DevOps 平台架构设计，遵循"**无缝集成、最小侵入**"原则。

## 与现有系统的集成点

### 1. 数据库层面

#### 复用现有表（3 个）

**repositories 表**
- 现有用途：存储项目的 Git 仓库信息
- 新增字段：
  - `gitopsConfig` (JSONB) - GitOps 配置
  - `fluxSyncStatus` (text) - Flux 同步状态
  - `fluxLastSyncCommit` (text) - 最后同步的 commit
  - `fluxLastSyncTime` (timestamp) - 最后同步时间
  - `fluxErrorMessage` (text) - 错误信息

**deployments 表**
- 现有用途：记录所有部署历史
- 新增字段：
  - `gitopsResourceId` (uuid) - 关联 GitOps 资源
  - `deploymentMethod` (text) - 部署方式：'manual' | 'gitops-ui' | 'gitops-git' | 'pipeline'
  - `gitCommitSha` (text) - Git commit SHA（用于 GitOps）

**environments 表**
- 现有用途：管理项目环境配置
- 扩展 config JSONB：
  - `gitops.enabled` - 是否启用 GitOps
  - `gitops.autoSync` - 是否自动同步
  - `gitops.gitBranch` - 对应的 Git 分支
  - `gitops.gitPath` - K8s 配置路径
  - `gitops.syncInterval` - 同步间隔

#### 新增表（1 个）

**gitops_resources 表**
- 用途：存储 Flux 资源配置（Kustomization 或 HelmRelease）
- 关联：projectId、environmentId、repositoryId
- 特点：使用 JSONB 存储所有配置，灵活可扩展

#### 复用现有表（无需修改）

**audit_logs 表**
- 用途：记录所有 GitOps 操作和 Flux 事件
- 新增 action 类型：
  - `gitops.sync.started`
  - `gitops.sync.completed`
  - `gitops.sync.failed`
  - `gitops.resource.created`
  - `gitops.resource.updated`

**notifications 表**
- 用途：发送 GitOps 相关通知
- 复用现有通知系统

### 2. 服务层面

#### 新增服务（2 个）

**FluxService**
- 职责：管理 Flux 安装、资源创建、状态查询
- 依赖：K3sService（现有）
- 位置：`packages/services/flux`

**GitOpsService**
- 职责：处理 UI → Git 转换、Git 操作、YAML 生成
- 依赖：FluxService、RepositoriesService（现有）
- 位置：`packages/services/git-ops`

#### 扩展现有服务

**DeploymentsService**
- 新增方法：`deployWithGitOps()`
- 集成：调用 GitOpsService 创建 commit

**RepositoriesService**
- 新增方法：`enableGitOps()`, `getFluxStatus()`
- 集成：管理仓库的 GitOps 配置

**EnvironmentsService**
- 新增方法：`configureGitOps()`
- 集成：配置环境级 GitOps 设置

### 3. API 层面

#### 新增 Router（1 个）

**GitOpsRouter**
- 路径：`/api/trpc/gitops.*`
- 端点：
  - `installFlux`
  - `createGitOpsResource`
  - `deployWithGitOps`
  - `getFluxEvents`
  - `triggerSync`

#### 扩展现有 Router

**DeploymentsRouter**
- 新增端点：`deployWithGitOps`
- 保持向后兼容：现有 `create` 端点继续工作

**RepositoriesRouter**
- 新增端点：`enableGitOps`, `getFluxStatus`

### 4. UI 层面

#### 新增页面（2 个）

- `GitOpsSettings.vue` - GitOps 设置页面
- `GitOpsConfigEditor.vue` - 可视化配置编辑器

#### 扩展现有页面

**Repositories.vue**
- 新增：GitOps 启用开关
- 新增：Flux 同步状态显示

**Deployments.vue**
- 新增：部署方式标识（manual/gitops-ui/gitops-git）
- 新增：Git commit 信息显示

**DeploymentDialog.vue**
- 新增：GitOps 模式提示
- 新增：Commit 消息输入

**Environments.vue**
- 新增：GitOps 配置选项卡

## 设计原则遵循

### 1. 保持现有架构模式 ✅

- Module + Router + Service 模式
- tRPC 类型安全 API
- Drizzle ORM 数据访问
- JSONB 存储灵活配置

### 2. 精简表结构 ✅

- 只新增 1 个核心表（gitops_resources）
- 扩展 3 个现有表（repositories、deployments、environments）
- 复用 2 个现有表（audit_logs、notifications）

### 3. JSONB 优先 ✅

- GitOps 配置存储在 JSONB
- Flux 资源配置存储在 JSONB
- 环境 GitOps 设置存储在 JSONB

### 4. 软删除 ✅

- gitops_resources 表包含 deletedAt
- 遵循现有软删除模式

### 5. 类型安全 ✅

- 端到端 TypeScript
- Zod schema 验证
- Drizzle 类型推导

## 向后兼容性

### 数据库

- ✅ 所有新增字段都是可选的（nullable）
- ✅ 现有数据不受影响
- ✅ 可以逐步迁移到 GitOps

### API

- ✅ 现有 API 端点保持不变
- ✅ 新增端点不影响现有功能
- ✅ 部署方法默认为 'manual'

### UI

- ✅ 现有页面功能保持不变
- ✅ GitOps 功能作为可选增强
- ✅ 用户可以选择是否启用

## 迁移路径

### 阶段 1: 基础设施（不影响现有功能）

1. 安装 Flux v2 到 K3s
2. 创建 gitops_resources 表
3. 添加新字段到现有表（migration）

### 阶段 2: 核心功能（可选启用）

1. 实现 FluxService 和 GitOpsService
2. 实现 GitOps API
3. 用户可以选择为项目启用 GitOps

### 阶段 3: UI 集成（渐进增强）

1. 在现有页面添加 GitOps 选项
2. 创建 GitOps 专用页面
3. 用户可以选择部署方式

## 测试策略

### 单元测试

- FluxService 测试
- GitOpsService 测试
- 扩展的 DeploymentsService 测试

### 集成测试

- GitOps 完整流程测试
- 与现有部署流程的兼容性测试
- 数据库迁移测试

### E2E 测试

- UI 部署流程测试
- Git push 触发部署测试
- 审批流程测试

## 风险评估

### 低风险 ✅

- 新增表不影响现有功能
- 新增字段都是可选的
- 新增服务独立运行

### 中风险 ⚠️

- 扩展现有服务需要仔细测试
- 数据库迁移需要备份
- Flux 安装可能影响 K3s 性能

### 缓解措施

- 完整的测试覆盖
- 数据库迁移前备份
- Flux 资源限制配置
- 分阶段发布

## 总结

本 GitOps 集成方案：

✅ **完全基于现有架构** - 遵循所有设计原则
✅ **最小化侵入** - 只新增 1 个表，扩展 3 个表
✅ **向后兼容** - 不影响现有功能
✅ **渐进式采用** - 用户可以选择是否启用
✅ **双向 GitOps** - 降低学习曲线，保留灵活性

这是一个**系统化、一致性、可维护**的集成方案！🎯
