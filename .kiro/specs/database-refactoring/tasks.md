# 数据库架构重构 - 任务列表

> 基于 `docs/architecture/database-refactoring-plan.md` 的详细分析

---

## 阶段 1：紧急修复（P0 优先级）

### 1. 合并 `oauth_accounts` 和 `user_git_accounts` 表 ✅

- [x] 1.1 创建新的统一表 schema
  - 创建 `packages/core/src/database/schemas/git-connections.schema.ts`
  - 合并两个表的所有字段
  - 添加 `purpose` 字段区分用途（'auth' | 'integration' | 'both'）
  - 定义唯一索引和性能索引
  - _需求: 1.1, 1.2, 1.3_

- [x] 1.2 创建数据迁移脚本
  - 编写 Drizzle 迁移脚本创建新表
  - 编写数据迁移逻辑（合并两表数据）
  - 处理数据冲突（同一用户在两表都有记录）
  - 验证数据完整性
  - _需求: 1.5_

- [x] 1.3 更新所有使用 `oauth_accounts` 的代码
  - 更新 `OAuthAccountsService`
  - 更新登录认证相关代码
  - 更新 `ProjectsService.delete()` 中的删除仓库逻辑
  - 更新所有查询 OAuth token 的地方
  - _需求: 1.2, 1.4_

- [x] 1.4 更新所有使用 `user_git_accounts` 的代码
  - 更新 `GitAccountLinkingService`
  - 更新 `ProjectInitializationWorker`
  - 更新 `GitSyncWorker`
  - 更新 `ConflictResolutionService`
  - _需求: 1.2, 1.4_

- [x] 1.5 删除旧表并清理代码
  - 创建迁移脚本删除 `user_git_accounts` 表
  - 删除 `user_git_accounts.schema.ts` 文件
  - 更新 `database/relations.ts`
  - 更新所有导入语句
  - _需求: 1.1_

- [x]* 1.6 测试 Git 账户相关功能
  - 测试用户登录（OAuth）
  - 测试连接 Git 账户
  - 测试创建项目（需要 Git token）
  - 测试删除项目并删除仓库
  - 测试 Git 同步功能
  - _需求: 1.3, 1.4_

---

### 2. 清理 `repositories` 表的 Flux 状态字段 ✅

- [x] 2.1 确认 Flux 字段的使用情况
  - 搜索代码中所有使用 `fluxSyncStatus` 的地方
  - 搜索代码中所有使用 `fluxLastSyncCommit` 的地方
  - 搜索代码中所有使用 `fluxLastSyncTime` 的地方
  - 搜索代码中所有使用 `fluxErrorMessage` 的地方
  - 确认是否需要迁移数据到 `gitops_resources`
  - _需求: 2.1, 2.4_

- [x] 2.2 更新代码使用 `gitops_resources` 表
  - 修改 `RepositoriesService` 查询 Flux 状态的逻辑
  - 修改前端查询 Flux 状态的 API
  - 通过 `gitops_resources` 表关联查询
  - _需求: 2.4_

- [x] 2.3 创建迁移脚本删除字段
  - 编写 Drizzle 迁移脚本
  - 删除 `fluxSyncStatus` 字段
  - 删除 `fluxLastSyncCommit` 字段
  - 删除 `fluxLastSyncTime` 字段
  - 删除 `fluxErrorMessage` 字段
  - _需求: 2.1_

- [x] 2.4 更新 `repositories.schema.ts`
  - 删除 Flux 相关字段定义
  - 更新类型导出
  - _需求: 2.1_

- [x]* 2.5 测试仓库和 Flux 状态查询
  - 测试查询仓库信息
  - 测试查询 Flux 同步状态
  - 验证前端显示正确
  - _需求: 2.4_

---

### 3. 删除 `projects` 表的冗余 Git 字段 ✅

- [x] 3.1 确认 Git 字段的使用情况
  - 搜索代码中所有使用 `gitProvider` 的地方
  - 搜索代码中所有使用 `gitRepoUrl` 的地方
  - 搜索代码中所有使用 `gitRepoName` 的地方
  - 搜索代码中所有使用 `gitDefaultBranch` 的地方
  - _需求: 3.1, 3.5_

- [x] 3.2 更新 `ProjectsService` 查询逻辑
  - 修改所有直接访问 Git 字段的代码
  - 改为通过 `repositories` 表关联查询
  - 更新 `getProject()` 方法包含 repository 关联
  - 更新 `listProjects()` 方法包含 repository 关联
  - _需求: 3.2, 3.5_

- [x] 3.3 更新前端代码
  - 修改前端显示项目 Git 信息的组件
  - 更新 tRPC 返回的数据结构
  - 确保前端能正确显示 Git 信息
  - _需求: 3.5_

- [x] 3.4 创建迁移脚本删除字段
  - 编写 Drizzle 迁移脚本
  - 删除 `gitProvider` 字段
  - 删除 `gitRepoUrl` 字段
  - 删除 `gitRepoName` 字段
  - 删除 `gitDefaultBranch` 字段
  - _需求: 3.1_

- [x] 3.5 更新 `projects.schema.ts`
  - 删除 Git 相关字段定义
  - 更新类型导出
  - _需求: 3.1_

- [x]* 3.6 测试项目 Git 信息显示
  - 测试前端项目列表显示
  - 测试项目详情页显示
  - 验证 Git 信息正确
  - _需求: 3.5_

---

## 阶段 2：架构优化（P1 优先级）

### 4. 拆分 `projects.initializationStatus` 为独立表

- [x] 4.1 创建 `project_initialization_steps` 表
  - 创建 `packages/core/src/database/schemas/project-initialization-steps.schema.ts`
  - 定义字段：projectId, step, status, progress, error, startedAt, completedAt
  - 添加索引优化查询
  - _需求: 8.1_

- [x] 4.2 简化 `projects` 表的初始化字段
  - 删除 `initializationStatus` JSONB 字段
  - 添加 `initializationJobId` 字段
  - 添加 `initializationStartedAt` 字段
  - 添加 `initializationCompletedAt` 字段
  - 添加 `initializationError` 字段
  - _需求: 8.2_

- [x] 4.3 更新 `ProjectInitializationWorker`
  - 修改每个步骤开始时插入记录到 `project_initialization_steps`
  - 修改每个步骤完成时更新记录状态
  - 修改每个步骤失败时记录错误
  - 保持 Redis 发布事件的逻辑
  - _需求: 8.3_

- [x] 4.4 更新 tRPC subscription
  - 修改 `subscribeInitialization` 返回所有步骤的数组
  - 包含每个步骤的 step, status, progress, startedAt, completedAt
  - 计算每个步骤的耗时
  - _需求: 8.6_

- [x] 4.5 更新前端 `ProjectWizard.vue`
  - 修改显示逻辑，展示每个步骤的详细进度
  - 显示步骤名称、状态图标、进度条、耗时
  - 优化 UI 设计，提升用户体验
  - _需求: 8.4, 8.6_

- [x] 4.6 创建数据迁移脚本
  - 编写迁移脚本创建新表
  - 编写迁移脚本修改 `projects` 表
  - 不需要迁移历史数据（开发阶段）
  - _需求: 8.1, 8.2_

- [ ]* 4.7 测试项目初始化流程
  - 测试创建新项目
  - 验证前端显示每个步骤的进度
  - 验证 SSE 实时推送
  - 测试初始化失败的情况
  - 验证错误信息正确显示
  - _需求: 8.4, 8.5, 8.6_

---

### 5. 清理 `deployments` 表的 GitOps 字段 ✅

- [x] 5.1 删除重复的 `gitCommitSha` 字段
  - 确认 `gitCommitSha` 和 `commitHash` 的使用情况
  - 统一使用 `commitHash`（存储完整 SHA）
  - 更新所有使用 `gitCommitSha` 的代码
  - 创建迁移脚本删除 `gitCommitSha` 字段
  - _需求: 9.1_

- [x] 5.2 简化 `deploymentMethod` 字段
  - 将 4 种值简化为 2 种：'gitops' | 'manual'
  - 更新所有设置 `deploymentMethod` 的代码
  - 更新注释说明
  - 创建迁移脚本更新现有数据
  - _需求: 9.2_

- [x] 5.3 更新 `deployments.schema.ts`
  - 删除 `gitCommitSha` 字段定义
  - 更新 `deploymentMethod` 注释
  - 更新 `commitHash` 注释（说明存储完整 SHA）
  - 更新类型导出
  - _需求: 9.1, 9.2_

- [ ]* 5.4 测试部署记录功能
  - 测试 GitOps 自动部署
  - 测试手动部署
  - 验证部署历史显示正确
  - _需求: 9.5_

---

### 6. 优化 `environments` 表的 GitOps 配置 ✅

- [x] 6.1 避免循环依赖
  - 不在 `environments` 表添加 `gitopsResourceId` 外键
  - 通过 `gitops_resources.environmentId` 反向查询
  - 避免循环依赖问题
  - _需求: 10.3_

- [x] 6.2 简化 `config` JSONB 字段
  - 从 `config.gitops` 中移除 GitOps 配置
  - 这些配置已在 `gitops_resources.config` 中
  - 更新类型定义
  - _需求: 10.2_

- [x] 6.3 应用数据库迁移
  - 更新 schema 定义
  - 应用迁移脚本
  - Schema 同步成功
  - _需求: 10.1, 10.2_

- [ ]* 6.4 测试环境和 GitOps 资源关联
  - 测试创建环境
  - 测试查询环境的 GitOps 状态
  - 验证关联关系正确
  - _需求: 10.1, 10.2_

---

### 7. 完善 `gitops_resources` 表的状态字段 ✅

- [x] 7.1 添加状态时间戳字段
  - 添加 `statusReason` 字段（状态原因）
  - 添加 `statusMessage` 字段（详细消息）
  - 添加 `lastStatusUpdateAt` 字段
  - 添加 `lastAppliedAt` 字段
  - 添加 `lastAttemptedAt` 字段
  - _需求: 12.1_

- [x] 7.2 更新 `gitops_resources.schema.ts`
  - 添加新字段定义
  - 更新类型导出
  - _需求: 12.1_

- [x] 7.3 应用数据库迁移
  - 添加新字段
  - Schema 同步成功
  - _需求: 12.1_

- [ ]* 7.4 更新 Flux 状态同步逻辑
  - 修改 `FluxStatusSyncService`（如果已实现）
  - 在状态更新时记录时间戳
  - 记录状态原因和消息
  - _需求: 12.1_

- [ ]* 7.5 测试 GitOps 状态追踪
  - 测试状态更新
  - 验证时间戳正确记录
  - 测试查询长时间未更新的资源
  - _需求: 12.1_

---

## 阶段 3：规范统一（P2 优先级）

### 8. 统一命名规范

- [x] 8.1 统一状态字段命名
  - 将所有 `syncStatus` 改为 `status`
  - 确保所有表的状态字段都叫 `status`
  - 更新相关代码
  - _需求: 7.1_

- [ ] 8.2 统一时间戳字段格式
  - 确保所有时间戳使用 `timestamp('field', { withTimezone: true })`
  - 统一使用 `camelCase` 命名
  - 统一使用 `createdAt` 和 `updatedAt`
  - _需求: 7.3_

- [x] 8.3 创建数据库设计规范文档
  - 编写命名规范
  - 编写字段类型规范
  - 编写索引规范
  - 提供示例
  - _需求: 7.1, 7.3_

---

## 阶段 4：文档和验证

### 9. 更新文档

- [x] 9.1 创建数据库 Schema 文档
  - 记录每个表的用途
  - 记录每个字段的含义
  - 记录表之间的关系
  - _需求: 9.1, 9.2_

- [x] 9.2 创建实体关系图（ERD）
  - 使用 Mermaid 或其他工具
  - 展示所有表的关系
  - 标注外键和索引
  - _需求: 9.3_

- [x] 9.3 更新架构设计文档
  - 更新 `docs/architecture/database-refactoring-plan.md` 状态为"已完成"
  - 记录实际执行情况
  - 记录遇到的问题和解决方案
  - _需求: 9.5_

---

### 10. 最终验证

- [ ] 10.1 数据完整性验证
  - 验证所有外键关系正确
  - 验证所有索引已创建
  - 验证无数据丢失
  - _需求: 7.3, 7.4_

- [ ] 10.2 功能测试
  - 测试用户登录和认证
  - 测试项目创建和初始化
  - 测试环境创建和管理
  - 测试部署流程
  - 测试 GitOps 同步
  - 测试删除项目和仓库
  - _需求: 8.6_

- [ ] 10.3 性能测试
  - 测试常见查询的性能
  - 对比重构前后的性能
  - 验证索引优化效果
  - _需求: 8.6_

- [x] 10.4 代码审查
  - Review 所有修改的代码
  - 确保代码质量
  - 确保遵循项目规范
  - _需求: 8.1, 8.2_

---

## 注意事项

### 数据迁移安全

- 每次迁移前备份数据库
- 在测试环境充分验证
- 准备回滚脚本
- 记录迁移日志

### 测试策略

- 标记 `*` 的任务为可选测试任务
- 核心功能必须有测试覆盖
- 重点测试数据迁移的正确性
- 重点测试外键关系的完整性

### 执行顺序

- 严格按阶段顺序执行
- 每个阶段完成后验证功能正常
- 发现问题立即修复，不要累积
- 保持代码随时可运行

### 回滚策略

- 每个任务都要考虑回滚方案
- 保留所有迁移脚本
- 记录每次变更的影响范围
- 出现问题立即回滚，不要硬撑

---

## 预计工作量

- **阶段 1**: 3-4 天（P0 优先级，必须完成）
- **阶段 2**: 4-5 天（P1 优先级，应该完成）
- **阶段 3**: 1-2 天（P2 优先级，可以延后）
- **阶段 4**: 1-2 天（文档和验证）

**总计**: 9-13 天（约 2 周）

---

## 成功标准

- [x] 所有 P0 和 P1 任务完成
- [x] 数据库设计清晰，无功能重复
- [x] 代码更易维护，技术债减少
- [ ] 所有测试通过，功能正常运行（需要添加测试）
- [x] 文档完整，团队成员理解新设计
