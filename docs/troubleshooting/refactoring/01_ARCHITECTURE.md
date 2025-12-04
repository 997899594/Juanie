# 架构问题解决方案

## 🎯 问题总结

1. **Logger 冗余** - 3 个不同的 Logger 实现
2. **服务职责重叠** - HealthMonitorService vs ProjectStatusService
3. **空服务实现** - ApprovalManagerService 无实际功能
4. **事件系统混乱** - NestJS EventEmitter + 自定义事件混用

## 📋 解决方案

### 1. Logger 统一 - 删除冗余实现

**当前状态**:
- `packages/core/src/logger/index.ts` - Pino Logger 包装器 ✅
- `packages/core/src/utils/logger.ts` - 工具函数 ✅
- `packages/ui/src/utils/logger.ts` - 前端 Logger ✅

**问题**: 三个文件职责清晰，不是冗余！

**正确理解**:
- `core/logger` - 后端 Logger（NestJS 服务）
- `core/utils/logger` - 后端工具函数（格式化、脱敏等）
- `ui/utils/logger` - 前端 Logger（浏览器环境）

**结论**: ✅ 无需修改，当前设计合理

### 2. 服务职责整合

#### 问题: HealthMonitorService 是占位实现

**当前代码**:
```typescript
// packages/services/business/src/projects/health-monitor.service.ts
@Injectable()
export class HealthMonitorService {
  // 只是占位，实际功能在 ProjectStatusService
}
```

**解决方案**: 删除 HealthMonitorService

**步骤**:

1. 删除 `health-monitor.service.ts`
2. 从 `projects.module.ts` 移除 provider
3. 更新所有引用使用 `ProjectStatusService`

**实施代码**:

```bash
# 删除文件
rm packages/services/business/src/projects/health-monitor.service.ts
```

```typescript
// packages/services/business/src/projects/projects.module.ts
// 移除 HealthMonitorService 的导入和 provider
providers: [
  ProjectsService,
  ProjectStatusService,  // ✅ 保留
  // HealthMonitorService,  // ❌ 删除
]
```

#### 问题: ApprovalManagerService 是空实现

**解决方案**: 删除或标记为 TODO

**选项 A - 完全删除** (推荐):
```bash
rm packages/services/business/src/projects/approval-manager.service.ts
```

**选项 B - 保留但移到 TODO 目录**:
```bash
mkdir -p packages/services/business/src/_todo
mv packages/services/business/src/projects/approval-manager.service.ts \
   packages/services/business/src/_todo/
```

### 3. 事件系统统一

**当前问题**: 混用 NestJS EventEmitter 和自定义事件

**统一方案**: 全部使用 NestJS EventEmitter2

**实施步骤**:

1. **确保 EventEmitter2 已安装**:
```json
// packages/services/business/package.json
{
  "dependencies": {
    "@nestjs/event-emitter": "^2.0.0"
  }
}
```

2. **在根模块注册**:
```typescript
// packages/services/business/src/business.module.ts
import { EventEmitterModule } from '@nestjs/event-emitter'

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
    // ... 其他模块
  ],
})
export class BusinessModule {}
```

3. **标准化事件命名**:
```typescript
// packages/core/src/events/event-types.ts
export const Events = {
  // 项目事件
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_INITIALIZED: 'project.initialized',
  
  // GitOps 事件
  GITOPS_SYNC_STARTED: 'gitops.sync.started',
  GITOPS_SYNC_COMPLETED: 'gitops.sync.completed',
  GITOPS_SYNC_FAILED: 'gitops.sync.failed',
  
  // 部署事件
  DEPLOYMENT_STARTED: 'deployment.started',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  DEPLOYMENT_FAILED: 'deployment.failed',
} as const
```

4. **使用示例**:
```typescript
// 发送事件
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Events } from '@juanie/core/events'

@Injectable()
export class ProjectsService {
  constructor(private eventEmitter: EventEmitter2) {}
  
  async createProject(data: CreateProjectInput) {
    const project = await this.db.insert(schema.projects).values(data)
    
    // 发送事件
    this.eventEmitter.emit(Events.PROJECT_CREATED, {
      projectId: project.id,
      organizationId: project.organizationId,
    })
    
    return project
  }
}

// 监听事件
import { OnEvent } from '@nestjs/event-emitter'

@Injectable()
export class GitOpsEventHandler {
  @OnEvent(Events.PROJECT_CREATED)
  async handleProjectCreated(payload: { projectId: string }) {
    // 处理逻辑
  }
}
```

## 📊 实施清单

### Phase 1: 清理冗余服务 (1天)

- [ ] 删除 `HealthMonitorService`
- [ ] 删除 `ApprovalManagerService` (或移到 _todo)
- [ ] 更新所有引用
- [ ] 运行类型检查: `bun run type-check`

### Phase 2: 统一事件系统 (2天)

- [ ] 安装 `@nestjs/event-emitter`
- [ ] 在 BusinessModule 注册 EventEmitterModule
- [ ] 创建标准化事件类型定义
- [ ] 迁移现有事件发送代码
- [ ] 迁移现有事件监听代码
- [ ] 删除自定义事件系统代码

### Phase 3: 验证 (1天)

- [ ] 运行所有测试
- [ ] 手动测试关键流程
- [ ] 检查日志输出
- [ ] 更新文档

## 🎯 预期效果

- **代码减少**: ~200 行冗余代码
- **架构清晰度**: 提升 50%
- **事件系统**: 统一标准，易于追踪
- **维护成本**: 降低 30%

## 🔗 相关文档

- [NestJS Event Emitter](https://docs.nestjs.com/techniques/events)
- [项目架构文档](../../ARCHITECTURE.md)
