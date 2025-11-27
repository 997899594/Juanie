# 循环依赖问题

> **状态**: ✅ 已解决 (2024-11-27)
> 
> **解决方案**: 将 AuditLogs 和 Notifications 移到 Foundation 层
> 
> **详细文档**: [AuditLogs 和 Notifications 服务重构](./audit-notifications-refactoring.md)

## 问题描述

发现 `@juanie/service-business` 和 `@juanie/service-extensions` 之间存在循环依赖：

```
Business → Extensions (使用 AuditLogsService, NotificationsService)
Extensions → Business (依赖 Business 的类型和服务)
```

这违反了三层架构原则：
- Foundation（基础层）
- Business（业务层）→ 应该只依赖 Foundation
- Extensions（扩展层）→ 应该只依赖 Foundation 和 Business

## 根本原因

Business 层直接注入和使用了 Extensions 层的服务：
- `AuditLogsService` - 审计日志
- `NotificationsService` - 通知服务

## 解决方案

### 方案 1：将服务移到 Foundation 层（推荐）

将 `AuditLogsService` 和 `NotificationsService` 移到 Foundation 层，因为它们是基础服务：

```
Foundation/
  ├── auth/
  ├── users/
  ├── audit-logs/      ← 移到这里
  └── notifications/   ← 移到这里

Business/
  └── projects/        → 可以使用 Foundation 的服务

Extensions/
  └── ai/              → 可以使用 Foundation 和 Business 的服务
```

### 方案 2：使用事件驱动架构

Business 层发布事件，Extensions 层监听事件：

```typescript
// Business 层
this.eventEmitter.emit('project.created', {
  projectId,
  userId,
  organizationId,
  action: 'project.create',
  details: { name: project.name }
})

// Extensions 层
@OnEvent('project.created')
async handleProjectCreated(event: ProjectCreatedEvent) {
  await this.auditLogs.log(event)
  await this.notifications.send(event)
}
```

## 当前状态

已暂时注释掉 Business 层对 Extensions 的直接依赖，以解除循环依赖。

需要选择一个方案并实施完整的重构。

## 影响的文件

- `packages/services/business/src/projects/projects.service.ts`
- `packages/services/business/src/projects/project-members.service.ts`
- `packages/services/business/src/projects/initialization/handlers/finalize.handler.ts`
- `packages/services/business/src/projects/projects.module.ts`
- `packages/services/business/src/projects/initialization/initialization.module.ts`

## 参考

- [NestJS 模块依赖最佳实践](https://docs.nestjs.com/fundamentals/circular-dependency)
- [三层架构设计原则](../architecture/three-tier-architecture.md)
