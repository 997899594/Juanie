# ProjectsService - 移除 Orchestrator 依赖

**日期**: 2025-12-24  
**状态**: 🚧 进行中  
**目标**: 移除 ProjectOrchestrator，简化项目创建流程

---

## 📊 当前问题

### 调用链

```
ProjectsService.create()
  → ProjectOrchestrator.createAndInitialize()
    → ProjectInitializationStateMachine.execute()  # ❌ 已删除
      → Handlers (6 个)  # ❌ 已删除
```

### 问题

1. **Orchestrator 依赖已删除的状态机**
2. **同步创建项目** - 阻塞 API 响应
3. **职责混乱** - ProjectsService 不应该知道初始化细节

---

## 🎯 重构方案

### 新的调用链

```
ProjectsService.create()
  1. 创建项目记录（status = 'initializing'）
  2. 创建环境记录
  3. 提交到 BullMQ 队列
  4. 立即返回项目 + jobId
  
Worker 异步执行
  → ProjectInitializationService.initialize()
    → 6 个步骤（线性执行）
```

### 优势

- ✅ **异步非阻塞** - API 立即返回
- ✅ **职责清晰** - Service 只负责创建记录
- ✅ **可重试** - BullMQ 自动重试
- ✅ **可监控** - BullMQ Dashboard

---

## 🔄 实现步骤

### 1. 重构 ProjectsService.create()

```typescript
async create(
  userId: string,
  data: CreateProjectInput,
): Promise<typeof schema.projects.$inferSelect & { jobId: string }> {
  // 1. 权限检查
  const ability = await this.caslAbilityFactory.createForUser(userId, data.organizationId)
  if (!ability.can('create', 'Project')) {
    throw new PermissionDeniedError('Project', 'create')
  }

  // 2. 创建项目记录
  const [project] = await this.db
    .insert(schema.projects)
    .values({
      organizationId: data.organizationId,
      name: data.name,
      slug: data.slug,
      description: data.description,
      visibility: data.visibility ?? 'private',
      status: 'initializing', // 初始化中
      createdBy: userId,
    })
    .returning()

  // 3. 创建环境记录
  const environments = await this.db
    .insert(schema.environments)
    .values([
      { projectId: project.id, name: 'Development', type: 'development' },
      { projectId: project.id, name: 'Staging', type: 'staging' },
      { projectId: project.id, name: 'Production', type: 'production' },
    ])
    .returning()

  // 4. 提交到队列
  const job = await this.queue.add('project-initialization', {
    projectId: project.id,
    userId,
    organizationId: data.organizationId,
    repository: data.repository,
    environmentIds: environments.map(env => env.id),
  })

  // 5. 立即返回
  return {
    ...project,
    jobId: job.id,
  }
}
```

### 2. 删除 ProjectOrchestrator

```bash
rm packages/services/business/src/projects/project-orchestrator.service.ts
```

### 3. 更新 ProjectsModule

移除 ProjectOrchestrator 的 provider 和 export。

### 4. 更新 exports

移除 `packages/services/business/src/projects/index.ts` 中的 ProjectOrchestrator 导出。

---

## ✅ 验收标准

- [ ] ProjectsService.create() 不再依赖 Orchestrator
- [ ] 项目创建立即返回（< 100ms）
- [ ] Worker 异步执行初始化
- [ ] 前端可以订阅进度
- [ ] 所有测试通过

---

## 📝 待处理

1. 重构 ProjectsService.create()
2. 删除 ProjectOrchestrator
3. 更新 ProjectsModule
4. 更新 exports
5. 运行测试

---

**下一步**: 重构 ProjectsService.create() 方法
