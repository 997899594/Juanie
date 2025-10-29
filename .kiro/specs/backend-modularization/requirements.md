# 后端模块化 Monorepo - 需求文档

## 简介

将当前的单体后端应用 `apps/api/` 重构为模块化的 Monorepo 架构，提高代码复用性、可维护性和团队协作效率。

本次重构聚焦于**立即改进**（1-2周）和**短期改进**（1-2月），不包括长期的微服务迁移。

## 术语表

- **Monorepo**: 单一代码仓库包含多个项目/包
- **Package**: 独立的 npm 包，可以被其他包依赖
- **Service Package**: 包含业务逻辑的服务包
- **Core Package**: 包含共享代码的核心包
- **API Gateway**: 聚合所有服务的 tRPC 路由的入口应用
- **Workspace Protocol**: Bun/pnpm 的 `workspace:*` 依赖协议

## 需求

### 需求 1: 创建核心共享包

**用户故事**: 作为开发者，我希望有统一的核心包来共享数据库 schemas、类型定义和工具函数，以便避免代码重复。

#### 验收标准

1. THE 系统 SHALL 创建 `packages/core/database` 包，包含所有 Drizzle schemas
2. THE 系统 SHALL 创建 `packages/core/types` 包，包含共享的 TypeScript 类型
3. THE 系统 SHALL 创建 `packages/core/utils` 包，包含共享的工具函数
4. WHEN 其他包需要数据库访问时，THE 系统 SHALL 通过 `@juanie/core-database` 导入
5. THE 系统 SHALL 确保所有核心包都有正确的 TypeScript 配置和构建脚本

### 需求 2: 提取服务模块为独立包

**用户故事**: 作为开发者，我希望每个业务模块都是独立的包，以便可以单独开发、测试和构建。

#### 验收标准

1. THE 系统 SHALL 将 `apps/api/src/modules/auth` 提取为 `packages/services/auth`
2. THE 系统 SHALL 将 `apps/api/src/modules/organizations` 提取为 `packages/services/organizations`
3. THE 系统 SHALL 将 `apps/api/src/modules/teams` 提取为 `packages/services/teams`
4. THE 系统 SHALL 将 `apps/api/src/modules/projects` 提取为 `packages/services/projects`
5. THE 系统 SHALL 将 `apps/api/src/modules/pipelines` 提取为 `packages/services/pipelines`
6. THE 系统 SHALL 将 `apps/api/src/modules/deployments` 提取为 `packages/services/deployments`
7. THE 系统 SHALL 将其余模块提取为对应的服务包
8. WHEN 服务包需要依赖其他服务时，THE 系统 SHALL 使用 workspace protocol
9. THE 系统 SHALL 确保每个服务包都有独立的 package.json 和 tsconfig.json

### 需求 3: 创建 API Gateway

**用户故事**: 作为开发者，我希望有一个 API Gateway 来聚合所有服务的 tRPC 路由，以便前端可以通过统一的入口访问。

#### 验收标准

1. THE 系统 SHALL 创建 `apps/api-gateway` 应用
2. THE 系统 SHALL 在 API Gateway 中导入所有服务的 tRPC 路由
3. THE 系统 SHALL 聚合所有路由到统一的 `appRouter`
4. THE 系统 SHALL 保持与原有 API 相同的路由结构
5. THE 系统 SHALL 确保类型安全在整个调用链中保持

### 需求 4: 保持向后兼容

**用户故事**: 作为开发者，我希望重构过程不破坏现有功能，以便可以渐进式迁移。

#### 验收标准

1. THE 系统 SHALL 保持所有 API 端点不变
2. THE 系统 SHALL 保持所有数据库 schemas 不变
3. THE 系统 SHALL 确保所有现有测试通过
4. THE 系统 SHALL 保持前端代码无需修改
5. WHEN 重构完成后，THE 系统 SHALL 提供迁移指南

### 需求 5: 优化构建和测试

**用户故事**: 作为开发者，我希望利用 Turborepo 的缓存和并行能力，以便加快构建和测试速度。

#### 验收标准

1. THE 系统 SHALL 配置 Turborepo 任务依赖关系
2. THE 系统 SHALL 启用 Turborepo 缓存
3. WHEN 只有部分包变更时，THE 系统 SHALL 只构建变更的包
4. THE 系统 SHALL 并行运行独立包的测试
5. THE 系统 SHALL 确保 CI/CD 利用 Turborepo 缓存

### 需求 6: 完善包管理

**用户故事**: 作为开发者，我希望有清晰的包依赖关系和版本管理，以便避免依赖冲突。

#### 验收标准

1. THE 系统 SHALL 在根 package.json 中统一管理共享依赖版本
2. THE 系统 SHALL 使用 workspace protocol 管理内部包依赖
3. THE 系统 SHALL 避免循环依赖
4. THE 系统 SHALL 为每个包定义明确的 exports
5. THE 系统 SHALL 确保包之间的依赖关系清晰可见

### 需求 7: 文档和示例

**用户故事**: 作为开发者，我希望有清晰的文档说明新架构，以便团队成员可以快速上手。

#### 验收标准

1. THE 系统 SHALL 创建架构文档说明新的目录结构
2. THE 系统 SHALL 提供如何创建新服务包的指南
3. THE 系统 SHALL 提供如何在服务间共享代码的示例
4. THE 系统 SHALL 更新开发环境设置文档
5. THE 系统 SHALL 提供故障排查指南

## 非功能需求

### 性能
- 构建时间应减少 30% 以上（通过 Turborepo 缓存）
- 测试执行时间应减少 40% 以上（通过并行执行）

### 可维护性
- 每个包的代码行数不超过 5000 行
- 包之间的依赖层级不超过 3 层
- 每个包都有独立的测试覆盖率报告

### 可扩展性
- 添加新服务包不应影响现有包
- 支持未来迁移到微服务架构

## 约束条件

1. 必须保持与现有 API 的完全兼容
2. 不能破坏现有的数据库结构
3. 必须使用 Bun 作为包管理器和运行时
4. 必须保持 tRPC 的类型安全特性
5. 重构过程中系统必须可以正常运行

## 实施阶段

### Phase 1: 立即改进（1-2 周）
- ✅ 需求 1: 创建核心共享包
- ✅ 需求 6: 完善包管理（部分）
- ✅ 需求 7: 文档和示例（基础）

### Phase 2: 短期改进（1-2 月）
- ✅ 需求 2: 提取服务模块为独立包
- ✅ 需求 3: 创建 API Gateway
- ✅ 需求 4: 保持向后兼容
- ✅ 需求 5: 优化构建和测试

### 不包括
- ❌ 微服务架构迁移
- ❌ 服务独立部署
- ❌ 分布式追踪和服务发现

## 优先级

- P0 (必须): 需求 1, 4
- P1 (重要): 需求 2, 3, 5
- P2 (可选): 需求 6, 7
