# AuditLogs 和 Notifications 服务重构

## 问题描述

在三层架构中发现循环依赖问题:

```
Extensions (扩展层)
    ↓ 依赖
Business (业务层) ← 循环依赖!
    ↓ 依赖
Extensions (AuditLogs, Notifications)
```

Business 层的服务(如 ProjectsService)需要使用 AuditLogs 和 Notifications,但这两个服务位于 Extensions 层,导致循环依赖。

## 根本原因

**架构设计错误**: AuditLogs 和 Notifications 是基础服务,不应该放在 Extensions 层。

- **AuditLogs**: 记录系统操作日志,是所有层都需要的基础功能
- **Notifications**: 发送通知,是所有层都需要的基础功能

这两个服务应该属于 Foundation 层,而不是 Extensions 层。

## 解决方案

### 方案选择

考虑了两个方案:

1. **使用事件驱动架构** - 通过事件解耦,避免直接依赖
2. **将服务移到 Foundation 层** - 重新组织架构,消除循环依赖

**选择方案 2**,原因:
- 更简洁直接
- 符合三层架构原则
- AuditLogs 和 Notifications 本质上就是基础服务
- 不需要引入额外的复杂性

## 实施步骤

### 1. 移动服务到 Foundation 层

```bash
# 创建目录
mkdir -p packages/services/foundation/src/audit-logs
mkdir -p packages/services/foundation/src/notifications

# 移动文件
cp -r packages/services/extensions/src/monitoring/audit-logs/* \
      packages/services/foundation/src/audit-logs/
cp -r packages/services/extensions/src/notifications/* \
      packages/services/foundation/src/notifications/
```

### 2. 更新 Foundation 模块

```typescript
// packages/services/foundation/src/foundation.module.ts
import { AuditLogsModule } from './audit-logs/audit-logs.module'
import { NotificationsModule } from './notifications/notifications.module'

@Module({
  imports: [
    // ... 其他模块
    AuditLogsModule,
    NotificationsModule,
  ],
  exports: [
    // ... 其他模块
    AuditLogsModule,
    NotificationsModule,
  ],
})
export class FoundationModule {}
```

### 3. 更新导出

```typescript
// packages/services/foundation/src/index.ts
export * from './audit-logs'
export * from './notifications'
// ... 其他导出
```

### 4. 更新 Business 层的导入

```typescript
// packages/services/business/src/projects/projects.service.ts
- import { AuditLogsService } from '@juanie/service-extensions'
+ import { AuditLogsService } from '@juanie/service-foundation'
```

### 5. 清理 Extensions 层

```bash
# 删除旧文件
rm -rf packages/services/extensions/src/monitoring/audit-logs
rm -rf packages/services/extensions/src/notifications

# 更新 Extensions 模块
# 移除 AuditLogsModule 和 NotificationsModule 的导入和导出
```

## 架构改进

### 重构前

```
Extensions (扩展层)
  ├── AI
  ├── Monitoring
  │   ├── AuditLogs ❌ (应该在 Foundation)
  │   └── CostTracking
  ├── Notifications ❌ (应该在 Foundation)
  └── Security

Business (业务层)
  └── 需要 AuditLogs 和 Notifications ❌ (循环依赖)

Foundation (基础层)
  ├── Auth
  ├── Users
  ├── Organizations
  ├── Teams
  └── Storage
```

### 重构后

```
Extensions (扩展层)
  ├── AI
  ├── Monitoring
  │   └── CostTracking
  └── Security

Business (业务层)
  └── 可以使用 Foundation 的所有服务 ✅

Foundation (基础层)
  ├── Auth
  ├── Users
  ├── Organizations
  ├── Teams
  ├── Storage
  ├── AuditLogs ✅ (新增)
  └── Notifications ✅ (新增)
```

### 依赖关系

```
Extensions (扩展层)
    ↓ 单向依赖
Business (业务层)
    ↓ 单向依赖
Foundation (基础层)
    ↓ 单向依赖
Core (核心包)
```

## 验证

### 1. 类型检查

```bash
bun run type-check
```

应该没有循环依赖错误。

### 2. 构建测试

```bash
bun run build
```

所有包应该能够成功构建。

### 3. 功能测试

- 创建项目时应该能够记录审计日志
- 项目操作应该能够发送通知
- 所有 Business 层服务应该能够正常使用 AuditLogs 和 Notifications

## 影响范围

### 修改的文件

**Foundation 层:**
- `packages/services/foundation/src/audit-logs/` (新增)
- `packages/services/foundation/src/notifications/` (新增)
- `packages/services/foundation/src/foundation.module.ts` (更新)
- `packages/services/foundation/src/index.ts` (更新)

**Business 层:**
- `packages/services/business/src/projects/projects.service.ts` (更新导入)
- `packages/services/business/src/projects/projects.module.ts` (更新导入)
- `packages/services/business/src/projects/initialization/initialization.module.ts` (更新导入)

**Extensions 层:**
- `packages/services/extensions/src/extensions.module.ts` (移除导入)
- `packages/services/extensions/src/index.ts` (移除导出)
- `packages/services/extensions/src/monitoring/audit-logs/` (删除)
- `packages/services/extensions/src/notifications/` (删除)

### 不需要修改的地方

- API Gateway 层 - 通过 AppModule 自动获得更新
- Web 前端 - 不直接依赖这些服务
- Core 包 - 不受影响

## 最佳实践

### 1. 服务分层原则

**Foundation 层应该包含:**
- 认证和授权
- 用户和组织管理
- 审计日志
- 通知服务
- 存储服务
- 其他所有层都需要的基础功能

**Business 层应该包含:**
- 业务逻辑
- 项目管理
- 部署管理
- GitOps 功能

**Extensions 层应该包含:**
- 可选功能
- AI 助手
- 高级监控(如成本追踪)
- 安全策略

### 2. 依赖方向

始终保持单向依赖:
```
Extensions → Business → Foundation → Core
```

### 3. 识别循环依赖

如果发现:
- A 层需要 B 层的服务
- B 层也需要 A 层的服务

解决方案:
1. 检查服务是否放错了层级
2. 考虑将共同依赖的服务下沉到更底层
3. 如果确实需要双向通信,使用事件驱动架构

## 相关文档

- [循环依赖问题](./circular-dependency.md)
- [三层架构设计](../../architecture/three-tier-architecture.md)
- [项目结构](../../../.kiro/steering/structure.md)

## 总结

这次重构通过将 AuditLogs 和 Notifications 移到正确的层级(Foundation),彻底解决了循环依赖问题。

**关键收获:**
1. 架构设计要遵循单向依赖原则
2. 基础服务应该放在 Foundation 层
3. 简洁的方案往往比复杂的方案更好
4. 及时重构,避免技术债务累积
