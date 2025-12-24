# NestJS Service vs Utils 最佳实践

## 问题

`GitCredentialsService` 是否应该作为独立的 Service？还是应该作为工具函数或 `GitConnectionsService` 的方法？

## NestJS 中的 Providers 分类

### 1. Services（服务）
**特征**：
- 有状态（依赖注入、数据库连接、配置）
- 需要生命周期管理
- 需要在多个地方注入使用
- 有复杂的业务逻辑

**示例**：
```typescript
@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private logger: Logger,
  ) {}

  async findById(id: string) {
    return this.db.query(...)
  }
}
```

### 2. Helpers/Utils（工具函数）
**特征**：
- 无状态的纯函数
- 不需要依赖注入
- 可以直接导入使用
- 简单的数据转换或验证

**示例**：
```typescript
// utils/string.utils.ts
export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-')
}

export function truncate(text: string, length: number): string {
  return text.length > length ? text.slice(0, length) + '...' : text
}
```

### 3. Factories（工厂）
**特征**：
- 创建复杂对象
- 可能需要依赖注入
- 封装创建逻辑

**示例**：
```typescript
@Injectable()
export class JwtTokenFactory {
  constructor(private config: ConfigService) {}

  createAccessToken(payload: any): string {
    return jwt.sign(payload, this.config.get('JWT_SECRET'))
  }
}
```

## 前沿实践参考

### 1. NestJS 官方项目

**@nestjs/jwt**：
```typescript
@Injectable()
export class JwtService {
  constructor(private options: JwtModuleOptions) {}
  
  sign(payload: any): string { ... }
  verify(token: string): any { ... }
}
```
✅ 使用 Service 因为需要配置状态

**@nestjs/passport**：
```typescript
export abstract class PassportStrategy {
  abstract validate(...args: any[]): any
}
```
✅ 使用抽象类/策略模式

### 2. 开源项目

**Amplication**：
```
src/
  core/
    utils/
      string.util.ts
      date.util.ts
  modules/
    auth/
      auth.service.ts
      auth.util.ts  # 模块内的工具函数
```

**Medusa**：
```
src/
  utils/
    is-email.ts
    is-string.ts
  services/
    user.service.ts
```

**NestJS Boilerplate**：
```
src/
  utils/
    validators/
    transformers/
  modules/
    auth/
      auth.service.ts
```

## GitCredentialsService 分析

### 当前实现
```typescript
@Injectable()
export class GitCredentialsService {
  constructor(
    private gitConnections: GitConnectionsService,
    private logger: Logger,
  ) {}

  async resolveCredentials(userId: string, provider: string) {
    const connection = await this.gitConnections.getConnectionWithDecryptedTokens(...)
    // 验证和返回
  }
}
```

### 问题
1. **过度抽象**：只是对 `GitConnectionsService` 的简单包装
2. **增加复杂度**：多了一层依赖注入
3. **职责不清**：和 `GitConnectionsService` 职责重叠

## 推荐方案

### 方案 1：合并到 GitConnectionsService（推荐）

```typescript
@Injectable()
export class GitConnectionsService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private encryption: EncryptionService,
    private logger: Logger,
  ) {}

  // 原有方法
  async getConnectionWithDecryptedTokens(userId: string, provider: string) { ... }

  // 新增方法（原 GitCredentialsService 的功能）
  async resolveCredentials(userId: string, provider: 'github' | 'gitlab') {
    const connection = await this.getConnectionWithDecryptedTokens(userId, provider)
    
    if (!connection) {
      throw new Error(`未找到 ${provider} OAuth 连接`)
    }

    if (!connection.accessToken || connection.status !== 'active') {
      throw new Error(`${provider} 访问令牌无效`)
    }

    if (!connection.username) {
      throw new Error(`${provider} 连接缺少用户名`)
    }

    return {
      accessToken: connection.accessToken,
      username: connection.username,
      email: connection.email,
    }
  }

  async resolveRepositoryConfig(userId: string, repository: any) {
    if (repository.accessToken !== '__USE_OAUTH__') {
      return repository
    }

    const credentials = await this.resolveCredentials(userId, repository.provider)
    return { ...repository, ...credentials }
  }
}
```

**优点**：
- ✅ 职责清晰：Git 连接相关的所有逻辑在一个 Service
- ✅ 减少依赖：不需要额外的 Service 注入
- ✅ 更易维护：相关代码在一起
- ✅ 符合单一职责原则：都是 Git 连接管理

### 方案 2：提取为工具函数（如果逻辑简单）

```typescript
// git-connections/git-credentials.utils.ts
export function validateGitCredentials(connection: any) {
  if (!connection) {
    throw new Error('Git 连接不存在')
  }

  if (!connection.accessToken || connection.status !== 'active') {
    throw new Error('访问令牌无效')
  }

  if (!connection.username) {
    throw new Error('缺少用户名')
  }

  return {
    accessToken: connection.accessToken,
    username: connection.username,
    email: connection.email,
  }
}

// 在 GitConnectionsService 中使用
async resolveCredentials(userId: string, provider: string) {
  const connection = await this.getConnectionWithDecryptedTokens(userId, provider)
  return validateGitCredentials(connection)
}
```

**优点**：
- ✅ 纯函数，易测试
- ✅ 可以在多个地方复用
- ✅ 不需要依赖注入

**缺点**：
- ❌ 如果需要 Logger 或其他依赖，不适用

### 方案 3：保持独立 Service（不推荐）

**适用场景**：
- 逻辑非常复杂（100+ 行）
- 需要独立的配置或状态
- 会被多个不相关的模块使用
- 需要独立的生命周期管理

**当前情况**：
- ❌ 逻辑简单（~50 行）
- ❌ 只是对 GitConnectionsService 的包装
- ❌ 只在项目初始化场景使用
- ❌ 不需要独立的生命周期

## 业界案例

### Stripe SDK
```typescript
class Stripe {
  customers: CustomersResource
  charges: ChargesResource
  
  // 不会为每个小功能创建独立的类
  // 而是按资源分组
}
```

### AWS SDK
```typescript
class S3Client {
  putObject()
  getObject()
  deleteObject()
  
  // 所有 S3 相关操作在一个类中
  // 不会拆分成 S3UploadService, S3DownloadService 等
}
```

### Prisma
```typescript
class PrismaClient {
  user: UserDelegate
  post: PostDelegate
  
  // 按数据模型分组，不是按操作类型
}
```

## 推荐的项目结构

```
packages/services/foundation/src/
  git-connections/
    git-connections.module.ts
    git-connections.service.ts      # 包含所有 Git 连接相关逻辑
    git-connections.types.ts        # 类型定义
    git-connections.utils.ts        # 纯函数工具（如果需要）
    __tests__/
      git-connections.service.spec.ts
```

## 重构步骤

1. **删除 `GitCredentialsService`**
2. **将方法合并到 `GitConnectionsService`**
3. **更新所有导入**
4. **更新测试**

## 总结

**核心原则**：
1. **按领域分组，不是按操作类型**
2. **避免过度抽象**
3. **Service 应该有明确的职责边界**
4. **简单的逻辑用工具函数，复杂的逻辑用 Service**

**GitCredentialsService 应该合并到 GitConnectionsService**，因为：
- 职责重叠（都是 Git 连接管理）
- 逻辑简单（只是验证和返回）
- 减少不必要的抽象层
- 符合业界最佳实践
