# Day 3-4: Git Credentials Unification Migration Plan

**Date**: 2025-12-24  
**Status**: Planning  
**Task**: Migrate Git credentials management from Business layer to Foundation layer

## Current Architecture Analysis

### Business Layer (`packages/services/business/src/gitops/credentials/`)

**Core Services**:
- `credential-manager.service.ts` - 凭证管理器（创建、验证、刷新、同步到 K8s）
- `credential-factory.ts` - 凭证工厂（根据类型创建凭证实例）
- `credential-strategy.service.ts` - 凭证策略（智能推荐认证方式）
- `health-monitor.service.ts` - 健康监控（定时检查凭证状态）

**Credential Implementations**:
- `oauth-credential.ts` - OAuth Token 凭证
- `pat-credential.ts` - Personal Access Token 凭证
- `github-app-credential.ts` - GitHub App 凭证
- `gitlab-group-token-credential.ts` - GitLab Group Token 凭证

**Interfaces**:
- `git-credential.interface.ts` - 凭证统一接口

**Module**:
- `credentials.module.ts` - 凭证管理模块

### Foundation Layer (`packages/services/foundation/src/git-connections/`)

**Current Services**:
- `GitConnectionsService` - 基础 Git 连接管理（OAuth 连接的 CRUD、Token 加密解密、Token 刷新）
- `git-connections.module.ts` - Git 连接模块

**Key Methods**:
- `resolveCredentials()` - 解析 Git 凭证（统一入口）
- `resolveRepositoryConfig()` - 解析仓库配置（兼容 `__USE_OAUTH__` 标记）
- `getConnectionWithDecryptedTokens()` - 获取解密后的连接
- `refreshGitLabToken()` - 刷新 GitLab Token
- `ensureValidToken()` - 确保 Token 有效（自动刷新）

## Architecture Violations

### Current Problems

1. **职责重复**:
   - Business 层的 `CredentialManagerService` 和 Foundation 层的 `GitConnectionsService` 都管理凭证
   - 加密逻辑分散在两个层级

2. **依赖方向错误**:
   - Business 层的凭证实现（`OAuthCredential`）依赖 Foundation 层的 `GitConnectionsService`
   - 这违反了分层架构原则（Business → Foundation → Core）

3. **K8s 同步逻辑放错位置**:
   - `CredentialManagerService.syncToK8s()` 是基础设施操作，不应该在 Business 层
   - 应该在 Foundation 层提供统一的凭证同步接口

4. **凭证策略混乱**:
   - `CredentialStrategyService` 是业务逻辑，应该保留在 Business 层
   - 但它依赖的凭证实现应该在 Foundation 层

## Migration Strategy

### Phase 1: Extend Foundation Layer (凭证解析和管理) ✅ DONE

**Goal**: 将凭证解析和管理逻辑移到 Foundation 层

**Simplified Approach** (不使用工厂模式):
- 直接在 `GitConnectionsService` 中实现所有凭证管理逻辑
- 凭证创建逻辑作为私有方法集成在服务内部
- 避免过度设计，保持代码简洁直接

**Actions Completed**:
1. ✅ 移动凭证实现到 Foundation 层:
   - `oauth-credential.ts` → `packages/services/foundation/src/git-connections/credentials/`
   - `pat-credential.ts` → `packages/services/foundation/src/git-connections/credentials/`
   - `github-app-credential.ts` → `packages/services/foundation/src/git-connections/credentials/`
   - `gitlab-group-token-credential.ts` → `packages/services/foundation/src/git-connections/credentials/`
   - `git-credential.interface.ts` → `packages/services/foundation/src/git-connections/credentials/`

2. ✅ 扩展 `GitConnectionsService`:
   - 添加 `getProjectCredential(projectId)` - 获取项目凭证
   - 添加 `createProjectCredential(projectId, userId)` - 创建项目凭证（OAuth）
   - 添加 `createPATCredential(...)` - 创建 PAT 凭证
   - 添加 `validateProjectCredential(projectId)` - 验证凭证
   - 添加 `refreshProjectCredential(projectId)` - 刷新凭证
   - 添加 `syncCredentialToK8s(projectId, credential)` - 同步凭证到 K8s
   - 添加 `deleteProjectCredential(projectId)` - 删除项目凭证
   - 添加私有方法 `createCredentialFromRecord()` - 从数据库记录创建凭证实例
   - 添加私有方法 `createOAuthCredentialInstance()` - 创建 OAuth 凭证实例
   - 添加私有方法 `createPATCredentialInstance()` - 创建 PAT 凭证实例
   - 添加私有方法 `createGitHubAppCredentialInstance()` - 创建 GitHub App 凭证实例
   - 添加私有方法 `createGitLabGroupTokenCredentialInstance()` - 创建 GitLab Group Token 凭证实例

3. ✅ 更新 Foundation 层模块:
   - 添加 K8sModule 依赖到 `GitConnectionsModule`
   - 导出凭证接口和实现

4. ✅ 构建验证通过

### Phase 2: Keep Business Layer Strategy (保留业务逻辑)

**Goal**: 保留 Business 层的业务逻辑服务

**Keep in Business Layer**:
- `credential-strategy.service.ts` - 凭证策略（业务逻辑：智能推荐）
- `health-monitor.service.ts` - 健康监控（业务逻辑：定时任务）

**Update Business Layer**:
- 更新 `CredentialStrategyService` 使用 Foundation 层的凭证接口
- 更新 `HealthMonitorService` 使用 Foundation 层的 `GitConnectionsService`
- 删除 `CredentialManagerService`（功能已移到 Foundation 层）

### Phase 3: Update Business Layer Consumers

**Goal**: 更新 Business 层所有使用凭证的服务

**Files to Update**:
- `packages/services/business/src/gitops/flux/flux-sync.service.ts`
- `packages/services/business/src/gitops/git-ops/git-ops.service.ts`
- `packages/services/business/src/gitops/git-sync/*.ts`
- `packages/services/business/src/projects/initialization/*.ts`
- `packages/services/business/src/repositories/*.ts`

**Changes**:
- 从 `@juanie/service-foundation` 导入凭证服务
- 使用 `GitConnectionsService.resolveProjectCredential()` 替代 `CredentialManagerService.getProjectCredential()`
- 使用 `GitConnectionsService.syncCredentialToK8s()` 替代 `CredentialManagerService.syncToK8s()`

### Phase 4: Cleanup

**Goal**: 删除 Business 层的冗余代码

**Delete**:
- `packages/services/business/src/gitops/credentials/credential-manager.service.ts`
- `packages/services/business/src/gitops/credentials/credential-factory.ts`
- `packages/services/business/src/gitops/credentials/oauth-credential.ts`
- `packages/services/business/src/gitops/credentials/pat-credential.ts`
- `packages/services/business/src/gitops/credentials/github-app-credential.ts`
- `packages/services/business/src/gitops/credentials/gitlab-group-token-credential.ts`
- `packages/services/business/src/gitops/credentials/git-credential.interface.ts`

**Keep**:
- `packages/services/business/src/gitops/credentials/credential-strategy.service.ts`
- `packages/services/business/src/gitops/credentials/health-monitor.service.ts`
- `packages/services/business/src/gitops/credentials/credentials.module.ts` (更新导入)

## Final Architecture

### Foundation Layer (`@juanie/service-foundation`)

```
git-connections/
├── git-connections.service.ts       # 扩展：凭证解析、创建、验证、刷新、同步
├── git-connections.module.ts
├── credential-factory.ts            # 凭证工厂
└── credentials/
    ├── git-credential.interface.ts  # 凭证接口
    ├── oauth-credential.ts          # OAuth 凭证实现
    ├── pat-credential.ts            # PAT 凭证实现
    ├── github-app-credential.ts     # GitHub App 凭证实现
    └── gitlab-group-token-credential.ts  # GitLab Group Token 凭证实现
```

### Business Layer (`@juanie/service-business`)

```
gitops/credentials/
├── credential-strategy.service.ts   # 凭证策略（业务逻辑）
├── health-monitor.service.ts        # 健康监控（业务逻辑）
└── credentials.module.ts            # 凭证模块（导入 Foundation）
```

## Import Guidelines

### Foundation Layer (Internal)
```typescript
// 凭证实现内部使用相对路径
import { GitConnectionsService } from '../git-connections.service'
import type { GitCredential } from './git-credential.interface'
```

### Business Layer → Foundation Layer
```typescript
// 从 Foundation 层导入凭证服务
import { GitConnectionsService } from '@juanie/service-foundation'
import type { GitCredential } from '@juanie/service-foundation'
```

### Foundation Layer → Core Layer
```typescript
// 从 Core 层导入基础设施
import { K8sClientService } from '@juanie/core/k8s'
import { encrypt, decrypt, getEncryptionKey } from '@juanie/core/encryption'
import { DatabaseModule } from '@juanie/core/database'
```

## Benefits

1. **清晰的职责分离**:
   - Foundation 层：凭证的 CRUD、加密解密、Token 刷新、K8s 同步
   - Business 层：凭证策略、健康监控、业务逻辑

2. **正确的依赖方向**:
   - Business → Foundation → Core
   - 不再有 Business 层依赖 Foundation 层的循环依赖

3. **统一的凭证管理**:
   - 所有凭证操作通过 `GitConnectionsService` 统一入口
   - 加密逻辑集中在 Foundation 层

4. **更好的可测试性**:
   - Foundation 层的凭证服务可以独立测试
   - Business 层的策略服务可以 mock Foundation 层

## Risks and Mitigation

### Risk 1: K8s 依赖
- **Problem**: Foundation 层需要依赖 Core 层的 `K8sClientService`
- **Mitigation**: 这是正确的依赖方向（Foundation → Core），符合分层架构

### Risk 2: 大量文件需要更新
- **Problem**: Business 层有很多文件使用凭证服务
- **Mitigation**: 
  - 先扩展 Foundation 层，保持向后兼容
  - 逐步更新 Business 层文件
  - 最后删除旧代码

### Risk 3: 测试覆盖
- **Problem**: 移动代码可能破坏现有功能
- **Mitigation**:
  - 每个阶段都进行构建验证
  - 保留 Business 层的健康监控服务
  - 使用相同的接口，减少破坏性变更

## Next Steps

1. ✅ Read and analyze all credential files (Done)
2. ⏳ Phase 1: Extend Foundation Layer
3. ⏳ Phase 2: Keep Business Layer Strategy
4. ⏳ Phase 3: Update Business Layer Consumers
5. ⏳ Phase 4: Cleanup
6. ⏳ Build verification and testing
7. ⏳ Update documentation

## References

- Master Plan: `docs/architecture/ARCHITECTURE-REFACTORING-MASTER-PLAN.md`
- Execution Log: `docs/architecture/REFACTORING-EXECUTION-LOG.md`
- Day 1-2 Report: `docs/architecture/DAY1-2-FLUX-MIGRATION-COMPLETE.md`
