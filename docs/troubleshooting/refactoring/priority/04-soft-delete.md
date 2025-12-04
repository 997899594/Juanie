# 任务 4: 软删除机制

**优先级**: 🟡 中  
**预计时间**: 2天  
**依赖**: 任务 3 (数据库索引)

---

## 📋 问题描述

### 现状

1. **硬删除导致数据丢失**
   - 项目删除后无法恢复
   - 审计日志不完整
   - 关联数据清理困难

2. **缺少统一的软删除机制**
   - 有的表有 `deletedAt`，有的没有
   - 查询时容易忘记过滤已删除数据
   - 恢复功能不完整

3. **级联删除问题**
   - 删除项目时，环境、部署等数据如何处理？
   - 删除组织时，项目如何处理？

### 影响

- ❌ 误删除无法恢复
- ❌ 数据审计不完整
- ❌ 用户体验差

---

## 🎯 方案

### 软删除设计

```typescript
// 所有需要软删除的表都添加这些字段
interface SoftDeletable {
  deletedAt: Date | null
  deletedBy: string | null
}

// 查询时自动过滤已删除数据
const activeProjects = await db.query.projects.findMany({
  where: isNull(schema.projects.deletedAt),
})
```

---

## 🔧 实施步骤

### 4.1 添加软删除字段 (0.5天)

```sql
-- packages/core/drizzle/0004_add_soft_delete.sql

-- 为主要表添加软删除字段
ALTER TABLE projects 
ADD COLUMN deleted_at TIMESTAMP,
ADD COLUMN deleted_by VARCHAR(255);

ALTER TABLE environments 
ADD COLUMN deleted_at TIMESTAMP,
ADD COLUMN deleted_by VARCHAR(255);

ALTER TABLE deployments 
ADD COLUMN deleted_at TIMESTAMP,
ADD COLUMN deleted_by VARCHAR(255);

-- 为已删除数据创建索引
CREATE INDEX idx_projects_deleted_at 
ON projects(deleted_at) 
WHERE deleted_at IS NOT NULL;
```

### 4.2 更新 Schema 定义 (0.5天)

```typescript
// packages/core/src/database/schemas/projects.schema.ts

export const projects = pgTable('projects', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  // ... 其他字段
  
  // 软删除字段
  deletedAt: timestamp('deleted_at'),
  deletedBy: varchar('deleted_by', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### 4.3 实现软删除服务 (0.5天)

```typescript
// packages/core/src/database/soft-delete.service.ts

@Injectable()
export class SoftDeleteService {
  /**
   * 软删除记录
   */
  async softDelete<T extends { deletedAt: Date | null }>(
    table: any,
    id: string,
    userId: string,
  ): Promise<void> {
    await this.db
      .update(table)
      .set({
        deletedAt: new Date(),
        deletedBy: userId,
      })
      .where(eq(table.id, id))
  }

  /**
   * 恢复已删除记录
   */
  async restore<T extends { deletedAt: Date | null }>(
    table: any,
    id: string,
  ): Promise<void> {
    await this.db
      .update(table)
      .set({
        deletedAt: null,
        deletedBy: null,
      })
      .where(eq(table.id, id))
  }

  /**
   * 永久删除（硬删除）
   */
  async hardDelete<T>(
    table: any,
    id: string,
  ): Promise<void> {
    await this.db
      .delete(table)
      .where(eq(table.id, id))
  }

  /**
   * 清理过期的已删除数据（30天后）
   */
  async cleanupExpired<T extends { deletedAt: Date | null }>(
    table: any,
  ): Promise<number> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await this.db
      .delete(table)
      .where(
        and(
          isNotNull(table.deletedAt),
          lt(table.deletedAt, thirtyDaysAgo),
        ),
      )

    return result.rowCount || 0
  }
}
```

### 4.4 更新业务服务 (0.5天)

```typescript
// packages/services/business/src/projects/projects.service.ts

@Injectable()
export class ProjectsService {
  constructor(
    private readonly softDelete: SoftDeleteService,
  ) {}

  /**
   * 删除项目（软删除）
   */
  async delete(userId: string, projectId: string) {
    // 检查权限
    await this.checkPermission(userId, projectId, 'delete')
    
    // 软删除项目
    await this.softDelete.softDelete(
      schema.projects,
      projectId,
      userId,
    )
    
    // 级联软删除关联数据
    await this.cascadeSoftDelete(projectId, userId)
    
    // 发布事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.PROJECT_DELETED,
      resourceId: projectId,
      userId,
    })
  }

  /**
   * 恢复项目
   */
  async restore(userId: string, projectId: string) {
    // 检查权限
    await this.checkPermission(userId, projectId, 'restore')
    
    // 恢复项目
    await this.softDelete.restore(schema.projects, projectId)
    
    // 级联恢复关联数据
    await this.cascadeRestore(projectId)
    
    // 发布事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.PROJECT_RESTORED,
      resourceId: projectId,
      userId,
    })
  }

  /**
   * 级联软删除
   */
  private async cascadeSoftDelete(projectId: string, userId: string) {
    // 软删除环境
    const environments = await this.db.query.environments.findMany({
      where: eq(schema.environments.projectId, projectId),
    })
    
    for (const env of environments) {
      await this.softDelete.softDelete(schema.environments, env.id, userId)
    }
    
    // 软删除部署
    const deployments = await this.db.query.deployments.findMany({
      where: eq(schema.deployments.projectId, projectId),
    })
    
    for (const deployment of deployments) {
      await this.softDelete.softDelete(schema.deployments, deployment.id, userId)
    }
  }
}
```

---

## ✅ 验收标准

- [ ] 所有主要表都有软删除字段
- [ ] 软删除功能正常工作
- [ ] 恢复功能正常工作
- [ ] 级联删除正确处理
- [ ] 查询自动过滤已删除数据
- [ ] 定时清理任务正常运行

---

## 📊 预期收益

- ✅ 误删除可以恢复
- ✅ 数据审计完整
- ✅ 用户体验提升

---

## 📝 相关文档

- [软删除设计](../../architecture/soft-delete.md)
