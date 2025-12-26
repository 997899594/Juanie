# Core 包重构总结

> 开始时间: 2024-12-24  
> 决策: 都用方案 A（使用成熟工具，直接删除不必要的封装）

## ✅ 已完成的工作

### 1. 创建基础错误类 ✅
- **文件**: `packages/core/src/errors/base-errors.ts`
- **内容**: 
  - BaseError（基础错误类）
  - NotFoundError（资源未找到）
  - ValidationError（验证错误）
  - UnauthorizedError（未授权）
  - ForbiddenError（权限拒绝）
  - ConflictError（资源冲突）
  - OperationFailedError（操作失败）
  - ErrorFactory（错误工厂）
  - handleServiceError（错误处理辅助函数）

### 2. 创建服务层错误类 ✅
- **Foundation 层**: `packages/services/foundation/src/errors.ts`
  - Git 连接相关错误（GitConnectionNotFoundError, GitConnectionInvalidError, TokenDecryptionError, TokenRefreshError）
  - OAuth 相关错误（OAuthError, InvalidStateError）
  - 加密相关错误（EncryptionKeyMissingError）
  - 组织相关错误（OrganizationNotFoundError, OrganizationMemberAlreadyExistsError, NotOrganizationMemberError, CannotRemoveOwnerError）
  - 团队相关错误（TeamNotFoundError, TeamMemberAlreadyExistsError, TeamMemberNotFoundError, NotTeamMemberError）
  - 通知相关错误（NotificationNotFoundError）
  - 权限相关错误（PermissionDeniedError）

- **Business 层**: `packages/services/business/src/errors.ts`
  - 项目相关错误（ProjectNotFoundError, ProjectAlreadyExistsError, ProjectInitializationError, ProjectCreationFailedError, TemplateLoadFailedError, EnvironmentCreationFailedError, RepositorySetupFailedError, FinalizationFailedError）
  - 环境相关错误（EnvironmentNotFoundError）
  - GitOps 相关错误（GitOpsSetupError）
  - 资源相关错误（ResourceNotFoundError, ResourceConflictError）
  - 存储相关错误（StorageError）
  - 配额相关错误（QuotaExceededError）

### 3. 创建迁移脚本 ✅
- **文件**: `scripts/migrate-core-refactoring.sh`
- **功能**: 批量更新导入路径

## 🔄 需要手动执行的步骤

由于改动涉及 100+ 文件，建议按以下顺序手动执行：

### 步骤 1: 更新 package.json exports

**文件**: `packages/core/package.json`

删除以下 exports:
```json
"./logger": {
  "types": "./dist/logger/index.d.ts",
  "default": "./dist/logger/index.js"
},
"./events": {
  "types": "./dist/events/index.d.ts",
  "default": "./dist/events/index.js"
},
"./rbac": {
  "types": "./dist/rbac/index.d.ts",
  "default": "./dist/rbac/index.js"
},
"./sse": {
  "types": "./dist/sse/index.d.ts",
  "default": "./dist/sse/index.js"
}
```

### 步骤 2: 添加 Foundation 和 Business 层的 exports

**文件**: `packages/services/foundation/package.json`

添加:
```json
"./errors": {
  "types": "./dist/errors.d.ts",
  "default": "./dist/errors.js"
}
```

**文件**: `packages/services/business/package.json`

添加:
```json
"./errors": {
  "types": "./dist/errors.d.ts",
  "default": "./dist/errors.js"
}
```

### 步骤 3: 批量替换导入路径

使用 IDE 的全局搜索替换功能：

#### 3.1 Logger 导入 (~100+ 处)
```typescript
// 查找
import { Logger } from '@juanie/core/logger'

// 替换为
import { PinoLogger } from 'nestjs-pino'

// 同时替换变量类型
private readonly logger: Logger
// 替换为
private readonly logger: PinoLogger
```

#### 3.2 Foundation 层错误导入 (~20 处)
```typescript
// 查找 (在 packages/services/foundation 目录下)
import { XXXError } from '@juanie/core/errors'

// 替换为
import { XXXError } from '@juanie/service-foundation/errors'
```

#### 3.3 Business 层错误导入 (~30 处)
```typescript
// 查找 (在 packages/services/business 目录下)
import { XXXError } from '@juanie/core/errors'

// 替换为
import { XXXError } from '@juanie/service-business/errors'
```

#### 3.4 Events 导入 (~30 处)
```typescript
// 查找
import { EventPublisher, DomainEvents, SystemEvents } from '@juanie/core/events'

// 替换为
import { EventEmitter2 } from '@nestjs/event-emitter'

// 同时替换使用方式
this.eventPublisher.emit('event.name', data)
// 替换为
this.eventEmitter.emit('event.name', data)
```

### 步骤 4: 删除不需要的文件

```bash
# 删除业务错误类
rm packages/core/src/errors/business-errors.ts

# 删除 Logger 服务
rm packages/core/src/logger/logger.service.ts

# 删除 Events 封装
rm packages/core/src/events/event-publisher.service.ts
rm packages/core/src/events/event-replay.service.ts

# 删除 SSE 模块（如果没有使用）
rm -rf packages/core/src/sse/

# 删除 RBAC 模块（需要先移动到 Foundation 层）
# 暂时保留，等待移动

# 删除 Repository Worker（需要先移动到 Business 层）
# 暂时保留，等待移动

# 删除 Utils 中不需要的文件
rm packages/core/src/utils/date.ts
rm packages/core/src/utils/string.ts
rm packages/core/src/utils/validation.ts
rm packages/core/src/utils/logger.ts
```

### 步骤 5: 简化 Events 模块

**文件**: `packages/core/src/events/events.module.ts`

```typescript
import { Global, Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: process.env.NODE_ENV === 'development',
    }),
  ],
  exports: [EventEmitterModule],
})
export class CoreEventsModule {}
```

### 步骤 6: 更新 Core 层 index.ts

**文件**: `packages/core/src/index.ts`

移除不再导出的模块:
```typescript
// 移除
export * from './logger'
export * from './events'
export * from './rbac'
export * from './sse'
```

### 步骤 7: 安装成熟库

```bash
# 安装 date-fns 替代自定义日期工具
bun add date-fns

# 安装 lodash 替代自定义字符串工具
bun add lodash
bun add -D @types/lodash
```

### 步骤 8: 更新所有使用 Utils 的地方

```typescript
// 日期工具
// 查找
import { formatDate } from '@juanie/core/utils'

// 替换为
import { format } from 'date-fns'

// 字符串工具
// 查找
import { camelCase } from '@juanie/core/utils'

// 替换为
import { camelCase } from 'lodash'
```

### 步骤 9: 编译和测试

```bash
# 重新安装依赖
bun install

# 类型检查
bun run type-check

# 编译
bun run build

# 运行测试
bun test
```

### 步骤 10: 更新文档

**文件**: `.kiro/steering/project-guide.md`

更新导入示例:
```typescript
// 错误处理 - 从各服务层导入
import { ProjectNotFoundError } from '@juanie/service-business/errors'
import { GitConnectionNotFoundError } from '@juanie/service-foundation/errors'
import { BaseError, ErrorFactory } from '@juanie/core/errors'

// Logger - 直接使用 nestjs-pino
import { PinoLogger } from 'nestjs-pino'

// Events - 直接使用 EventEmitter2
import { EventEmitter2 } from '@nestjs/event-emitter'
```

## 📊 预期收益

- ✅ Core 层代码量减少 ~1,500 行（50%）
- ✅ 分层架构违规清零
- ✅ 移除不必要的抽象层
- ✅ 使用成熟工具替代自定义实现
- ✅ 提高代码可维护性和可测试性

## ⚠️ 注意事项

1. **渐进式迁移**: 建议按模块逐步迁移，每次迁移后立即测试
2. **保持向后兼容**: 在过渡期可以保留旧的导出路径（添加 @deprecated 注释）
3. **自动化测试**: 每次迁移后运行完整的测试套件
4. **代码审查**: 所有改动都应该经过代码审查

## 🎯 下一步

1. **评审本文档** - 确认迁移步骤是否合理
2. **执行步骤 1-3** - 更新 package.json 和批量替换导入路径
3. **执行步骤 4-6** - 删除文件和简化模块
4. **执行步骤 7-9** - 安装依赖、编译和测试
5. **执行步骤 10** - 更新文档

---

**文档版本**: v1.0  
**最后更新**: 2024-12-24  
**状态**: ✅ 待执行
