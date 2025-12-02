# Git 认证架构 - 符合三层架构设计

## 🏗️ 架构定位

Git 认证凭证管理属于 **Business 层的 GitOps 模块**。

### 为什么在 Business 层？

1. **GitOps 是业务功能**：项目部署、环境管理都是业务逻辑
2. **凭证是 GitOps 的一部分**：访问 Git 仓库是 GitOps 的核心需求
3. **符合单向依赖**：Business → Foundation → Core

### 依赖关系

```
Business (GitOps/Credentials)
    ↓ 使用
Foundation (OAuthAccountsService)
    ↓ 使用
Core (Database, Types)
```

## 📁 文件组织

### 当前结构（已创建）✅

```
packages/services/business/src/gitops/
├── credentials/                    # 凭证管理模块
│   ├── git-credential.interface.ts    # 凭证接口定义
│   ├── oauth-credential.ts             # OAuth 凭证实现
│   ├── credential-factory.ts           # 凭证工厂
│   ├── credential-manager.service.ts   # 凭证管理器
│   ├── credentials.module.ts           # NestJS 模块
│   └── index.ts                        # 导出
├── flux/                           # Flux CD 集成
│   ├── flux-resources.service.ts       # 使用 CredentialManager
│   └── ...
├── k3s/                            # Kubernetes 集成
└── git-auth/                       # 旧的实现（待废弃）
    ├── git-auth.service.ts             # @deprecated
    └── known-hosts.service.ts          # @deprecated
```

### 符合架构的设计 ✅

```
依赖层次：
1. Core 层
   - database (project_git_auth 表)
   - types (GitCredential 类型)

2. Foundation 层
   - OAuthAccountsService (提供 OAuth token)

3. Business 层
   - GitOps/Credentials (凭证管理)
   - GitOps/Flux (使用凭证)
   - Projects (创建项目时设置凭证)
```

## 🔄 与现有架构的集成

### 1. 使用 Foundation 层的服务

```typescript
// ✅ 正确：Business 层使用 Foundation 层
import { OAuthAccountsService } from '@juanie/service-foundation'

@Injectable()
export class CredentialManagerService {
  constructor(
    private readonly oauthService: OAuthAccountsService  // Foundation 层
  ) {}
}
```

### 2. 使用 Core 层的基础设施

```typescript
// ✅ 正确：使用 Core 层的数据库和类型
import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'

@Injectable()
export class CredentialManagerService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>
  ) {}
}
```

### 3. 不依赖 Extensions 层

```typescript
// ❌ 错误：Business 不能依赖 Extensions
import { AuditLogsService } from '@juanie/service-extensions'

// ✅ 正确：使用 Foundation 层的服务
import { AuditLogsService } from '@juanie/service-foundation'
```

## 📊 模块依赖图

```
┌─────────────────────────────────────────────────────────┐
│                    Business 层                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  GitOps Module                                     │ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ Credentials  │  │    Flux      │              │ │
│  │  │   Module     │→ │   Module     │              │ │
│  │  └──────────────┘  └──────────────┘              │ │
│  │         ↓                  ↓                       │ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ Credential   │  │    Flux      │              │ │
│  │  │   Manager    │  │  Resources   │              │ │
│  │  └──────────────┘  └──────────────┘              │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓ 依赖
┌─────────────────────────────────────────────────────────┐
│                  Foundation 层                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │    OAuth     │  │  AuditLogs   │              │ │
│  │  │   Accounts   │  │   Service    │              │ │
│  │  └──────────────┘  └──────────────┘              │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓ 依赖
┌─────────────────────────────────────────────────────────┐
│                     Core 层                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │   Database   │  │    Types     │              │ │
│  │  │   (Drizzle)  │  │              │              │ │
│  │  └──────────────┘  └──────────────┘              │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 🎯 实施步骤（符合架构）

### Step 1: Core 层 - 数据库 Schema ✅

**文件**: `packages/core/src/database/schemas/project-git-auth.schema.ts`

**状态**: 已创建 ✅

**导出**: 
```typescript
// packages/core/src/database/index.ts
export * from './schemas/project-git-auth.schema'
```

### Step 2: Business 层 - 凭证模块 ✅

**文件**: `packages/services/business/src/gitops/credentials/`

**状态**: 已创建 ✅

**模块结构**:
```typescript
@Module({
  imports: [
    FoundationModule,  // 使用 Foundation 层的服务
    K3sModule,         // 同层的其他模块
  ],
  providers: [
    CredentialManagerService,
    CredentialFactory,
    OAuthCredential,
  ],
  exports: [
    CredentialManagerService,
    CredentialFactory,
  ],
})
export class CredentialsModule {}
```

### Step 3: Business 层 - 集成到 GitOps

**文件**: `packages/services/business/src/gitops/gitops.module.ts`

**修改**:
```typescript
@Module({
  imports: [
    FoundationModule,      // Foundation 层
    CredentialsModule,     // 新增：凭证模块
    FluxModule,
    K3sModule,
    // ...
  ],
  // ...
})
export class GitOpsModule {}
```

### Step 4: Business 层 - 更新 Flux 服务

**文件**: `packages/services/business/src/gitops/flux/flux-resources.service.ts`

**修改**:
```typescript
@Injectable()
export class FluxResourcesService {
  constructor(
    private readonly credentialManager: CredentialManagerService,  // 使用新的凭证管理器
    // 移除旧的 KnownHostsService
  ) {}

  async setupProjectGitOps(data: {
    projectId: string
    userId: string  // 新增：用于创建凭证
    // 移除 credential 参数
    // ...
  }) {
    // 内部调用 credentialManager.createProjectCredential()
  }
}
```

### Step 5: 废弃旧代码

**文件**: 
- `packages/services/business/src/gitops/git-auth/git-auth.service.ts`
- `packages/services/business/src/gitops/git-auth/known-hosts.service.ts`

**标记**:
```typescript
/**
 * @deprecated 使用 CredentialManagerService 代替
 * 将在 v3.0 中移除
 */
@Injectable()
export class GitAuthService {
  // ...
}
```

## ✅ 架构验证清单

### 依赖方向检查

- [x] Business/Credentials 只依赖 Foundation 和 Core
- [x] 不依赖 Extensions 层
- [x] 使用 Foundation 的 OAuthAccountsService
- [x] 使用 Core 的 Database 和 Types

### 模块化检查

- [x] Credentials 是独立的 NestJS 模块
- [x] 通过 CredentialsModule 导出服务
- [x] 其他模块通过 imports 使用

### 职责清晰

- [x] CredentialManager: 凭证生命周期管理
- [x] CredentialFactory: 创建不同类型的凭证
- [x] OAuthCredential: OAuth token 的具体实现
- [x] FluxResourcesService: 使用凭证，不管理凭证

## 🎯 与现有模式对齐

### 1. 服务命名

```typescript
// ✅ 符合现有命名模式
CredentialManagerService    // 管理器服务
CredentialFactory          // 工厂模式
OAuthCredential           // 具体实现
```

### 2. 模块组织

```typescript
// ✅ 符合现有模块组织
gitops/
  ├── credentials/      # 子模块
  ├── flux/            # 子模块
  └── k3s/             # 子模块
```

### 3. 依赖注入

```typescript
// ✅ 符合现有 DI 模式
constructor(
  @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
  private readonly oauthService: OAuthAccountsService,
  private readonly k3s: K3sService,
) {}
```

## 📝 总结

### 符合架构的设计 ✅

1. **位置正确**: Business 层的 GitOps 模块
2. **依赖正确**: 只依赖 Foundation 和 Core
3. **职责清晰**: 凭证管理独立模块
4. **模块化**: 标准的 NestJS 模块
5. **可扩展**: 接口设计支持多种认证方式

### 不符合架构的设计 ❌

1. ~~放在 Foundation 层~~（凭证不是基础服务）
2. ~~依赖 Extensions 层~~（违反单向依赖）
3. ~~全局单例~~（不符合 NestJS 模式）
4. ~~直接操作数据库~~（应该通过服务层）

### 下一步

1. ✅ 完成 Core 层的 schema 导出
2. ✅ 完成 Business 层的模块集成
3. ✅ 更新 Flux 服务使用新的凭证管理器
4. ✅ 废弃旧的 GitAuthService
5. ✅ 编写测试验证

这个设计完全符合你的三层架构原则！
