# 项目创建流程修复 - 设计文档

## 概述

本设计旨在修复项目创建流程中的职责混乱、数据一致性和反馈机制问题。核心思路是:
1. 明确ProjectsService和Orchestrator的职责边界
2. 将所有初始化逻辑封装在Orchestrator内,确保原子性
3. 优化返回值,减少不必要的查询
4. 增强错误处理和状态反馈

## 架构

### 当前架构问题

```
ProjectsService.create()
├── 权限检查 ✓
├── orchestrator.createAndInitialize()
│   ├── 状态机执行
│   └── 返回 InitializationResult
├── ❌ 添加项目成员 (应该在orchestrator内)
├── ❌ 记录审计日志 (应该在orchestrator内)
└── ❌ 查询项目返回 (orchestrator应该直接返回)
```

### 目标架构

```
ProjectsService.create()
├── 权限检查
├── orchestrator.createAndInitialize()
│   ├── CreateProjectHandler
│   ├── LoadTemplateHandler
│   ├── RenderTemplateHandler
│   ├── CreateEnvironmentsHandler (智能判断)
│   ├── SetupRepositoryHandler (可选,异步)
│   └── FinalizeHandler
│       ├── 添加项目成员
│       ├── 记录审计日志
│       ├── 发送通知
│       └── 返回完整项目对象
└── 直接返回orchestrator结果
```

## 组件和接口

### 1. InitializationResult 增强

```typescript
interface InitializationResult {
  success: boolean
  projectId: string
  project?: ProjectWithRelations  // 新增:完整项目对象
  jobIds?: string[]
  error?: string
  errorStep?: InitializationState  // 新增:失败步骤
}

interface ProjectWithRelations {
  id: string
  name: string
  slug: string
  description?: string
  organizationId: string
  visibility: 'public' | 'private' | 'internal'
  status: 'initializing' | 'active' | 'failed'
  config: ProjectConfig
  createdAt: Date
  updatedAt: Date
  // 关联数据
  members?: ProjectMember[]
  environments?: Environment[]
}
```

### 2. FinalizeHandler 重构

```typescript
@Injectable()
export class FinalizeHandler implements StateHandler {
  readonly name = 'FINALIZING' as const
  
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private notifications: NotificationsService,
    private audit: AuditLogsService,
  ) {}
  
  async execute(context: InitializationContext): Promise<void> {
    // 1. 添加项目成员 (从ProjectsService移过来)
    await this.addProjectOwner(context)
    
    // 2. 记录审计日志 (从ProjectsService移过来)
    await this.logAuditTrail(context)
    
    // 3. 更新项目状态
    await this.updateProjectStatus(context)
    
    // 4. 发送通知
    await this.sendNotification(context)
    
    // 5. 查询完整项目对象 (包含关联数据)
    context.projectWithRelations = await this.loadCompleteProject(context.projectId!)
  }
  
  private async addProjectOwner(context: InitializationContext): Promise<void> {
    await this.db.insert(schema.projectMembers).values({
      projectId: context.projectId!,
      userId: context.userId,
      role: 'owner',
    })
  }
  
  private async logAuditTrail(context: InitializationContext): Promise<void> {
    await this.audit.log({
      userId: context.userId,
      organizationId: context.organizationId,
      action: 'project.initialized',
      resourceType: 'project',
      resourceId: context.projectId!,
      metadata: {
        name: context.projectData.name,
        templateId: context.templateId,
        hasRepository: !!context.repositoryId,
      },
    })
  }
  
  private async loadCompleteProject(projectId: string): Promise<ProjectWithRelations> {
    return await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
      with: {
        members: {
          with: {
            user: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        environments: true,
      },
    })
  }
}
```

### 3. CreateEnvironmentsHandler 智能化

```typescript
@Injectable()
export class CreateEnvironmentsHandler implements StateHandler {
  readonly name = 'CREATING_ENVIRONMENTS' as const
  
  canHandle(context: InitializationContext): boolean {
    // 智能判断:如果模板已定义环境,跳过默认环境创建
    if (context.templateId && context.templateConfig?.environments) {
      this.logger.log('Template defines environments, skipping default creation')
      return false
    }
    return true
  }
  
  async execute(context: InitializationContext): Promise<void> {
    // 检查模板是否已创建环境
    const existingEnvs = await this.db.query.environments.findMany({
      where: eq(schema.environments.projectId, context.projectId!),
    })
    
    if (existingEnvs.length > 0) {
      this.logger.log(`Template already created ${existingEnvs.length} environments`)
      context.environmentIds = existingEnvs.map(e => e.id)
      return
    }
    
    // 创建默认环境
    const defaultEnvs = ['development', 'staging', 'production']
    const created = await Promise.all(
      defaultEnvs.map(type => 
        this.db.insert(schema.environments).values({
          projectId: context.projectId!,
          name: type,
          type: type as any,
          config: {},
        }).returning()
      )
    )
    
    context.environmentIds = created.flat().map(e => e.id)
  }
}
```

### 4. ProjectsService 简化

```typescript
@Injectable()
export class ProjectsService {
  async create(
    userId: string,
    data: CreateProjectInput,
  ): Promise<typeof schema.projects.$inferSelect & { jobIds?: string[] }> {
    // 1. 检查组织存在
    const [organization] = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, data.organizationId))
      .limit(1)

    if (!organization) {
      throw new OrganizationNotFoundError(data.organizationId)
    }

    // 2. 检查权限
    const ability = await this.caslAbilityFactory.createForUser(userId, data.organizationId)
    if (!ability.can('create', 'Project')) {
      throw new PermissionDeniedError('Project', 'create')
    }

    // 3. 调用orchestrator (所有逻辑都在里面)
    const result = await this.orchestrator.createAndInitialize(userId, {
      ...data,
      visibility: data.visibility ?? 'private',
    })

    // 4. 处理结果
    if (!result.success || !result.project) {
      throw new ProjectInitializationError(
        result.projectId || 'unknown',
        result.error || '项目初始化失败',
        result.errorStep,
      )
    }

    // 5. 直接返回 (不需要额外查询)
    return {
      ...result.project,
      jobIds: result.jobIds,
    }
  }
}
```

### 5. 状态机事务支持

```typescript
@Injectable()
export class ProjectInitializationStateMachine {
  async execute(context: InitializationContext): Promise<InitializationResult> {
    try {
      // 使用数据库事务包裹整个流程
      const result = await this.db.transaction(async (tx) => {
        // 注入事务到context
        context.tx = tx
        
        // 执行状态转换
        while (context.currentState !== 'COMPLETED' && context.currentState !== 'FAILED') {
          await this.transition(context)
        }
        
        if (context.currentState === 'FAILED') {
          throw context.error || new Error('Initialization failed')
        }
        
        return {
          success: true,
          projectId: context.projectId!,
          project: context.projectWithRelations,
          jobIds: context.jobIds,
        }
      })
      
      return result
    } catch (error) {
      this.logger.error('Initialization failed:', error)
      
      return {
        success: false,
        projectId: context.projectId || '',
        error: error instanceof Error ? error.message : String(error),
        errorStep: context.currentState,
      }
    }
  }
}
```

## 数据模型

### InitializationContext 扩展

```typescript
export interface InitializationContext {
  // 输入数据
  userId: string
  organizationId: string
  projectData: ProjectData
  templateId?: string
  templateConfig?: Record<string, any>
  repository?: RepositoryConfig

  // 运行时数据
  projectId?: string
  templatePath?: string
  environmentIds?: string[]
  repositoryId?: string
  gitopsResourceIds?: string[]
  jobIds?: string[]
  projectWithRelations?: ProjectWithRelations  // 新增

  // 状态
  currentState: InitializationState
  progress: number
  error?: Error
  
  // 事务支持
  tx?: DatabaseTransaction  // 新增
  
  // 进度推送
  publishDetail?: (detail: ProgressDetail) => Promise<void>
}
```

## 正确性属性

*属性是应该在所有有效执行中保持为真的特征或行为——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: Orchestrator返回完整对象
*对于任何*成功的项目创建,orchestrator返回的对象应该包含项目ID、名称、状态和所有基本字段,不需要额外查询
**验证: 需求 1.2**

### Property 2: 失败时无孤儿数据
*对于任何*项目创建失败,数据库中不应该存在该项目的任何记录(项目、成员、环境)
**验证: 需求 1.5**

### Property 3: 事务回滚完整性
*对于任何*在某个步骤失败的项目创建,所有已执行的数据库操作应该被回滚
**验证: 需求 2.2**

### Property 4: 数据一致性
*对于任何*项目创建,项目记录、owner成员记录和审计日志要么全部存在,要么全部不存在
**验证: 需求 2.3**

### Property 5: 模板环境检测
*对于任何*定义了environments的模板,系统应该检测到并跳过默认环境创建
**验证: 需求 3.1**

### Property 6: 智能环境创建
*对于任何*已定义环境的模板,系统不应该创建默认环境;对于未定义环境的模板,应该创建3个默认环境
**验证: 需求 3.2, 3.3**

### Property 7: 环境关联正确
*对于任何*创建的环境,都应该正确关联到对应的项目ID
**验证: 需求 3.4**

### Property 8: 状态反映异步任务
*对于任何*有仓库创建请求的项目,完成时状态应该是'initializing';对于没有异步任务的项目,状态应该是'active'
**验证: 需求 4.5**

### Property 9: GitOps请求记录
*对于任何*GitOps设置请求,系统应该在项目config中记录请求状态
**验证: 需求 5.1**

### Property 10: GitOps状态更新
*对于任何*GitOps资源创建完成,项目状态应该从'initializing'更新为'active'或'failed'
**验证: 需求 5.2**

### Property 11: GitOps失败记录
*对于任何*GitOps资源创建失败,系统应该记录错误信息到项目config
**验证: 需求 5.3**

### Property 12: 状态查询准确性
*对于任何*项目状态查询,返回的GitOps资源状态应该与数据库中的实际状态一致
**验证: 需求 5.4**

### Property 13: 返回对象完整性
*对于任何*成功创建的项目,返回对象应该包含id、name、slug、status、organizationId等所有基本字段
**验证: 需求 6.2**

### Property 14: 异步任务标识
*对于任何*有异步任务的项目创建,返回对象应该包含非空的jobIds数组
**验证: 需求 6.3**

### Property 15: 失败错误详情
*对于任何*初始化失败,返回的错误信息应该包含失败的步骤名称和具体原因
**验证: 需求 6.5**

### Property 16: 错误类型具体化
*对于任何*步骤失败,系统应该抛出具体的错误类型(不是通用Error)
**验证: 需求 7.1**

### Property 17: 错误信息完整性
*对于任何*错误,错误信息应该包含失败步骤和原因
**验证: 需求 7.2**

### Property 18: 数据库错误日志
*对于任何*数据库操作失败,系统应该记录包含SQL语句和参数的详细日志
**验证: 需求 7.3**

### Property 19: 外部服务错误分类
*对于任何*外部服务调用失败,系统应该区分临时错误(网络超时)和永久错误(认证失败)
**验证: 需求 7.4**

### Property 20: 重试机制
*对于任何*标记为可重试的错误,系统应该提供retry方法或返回重试标识
**验证: 需求 7.5**

## 错误处理

### 错误类型层次

```typescript
// 基础错误
export class ProjectInitializationError extends Error {
  constructor(
    public projectId: string,
    message: string,
    public step?: InitializationState,
    public retryable: boolean = false,
  ) {
    super(message)
    this.name = 'ProjectInitializationError'
  }
}

// 具体错误类型
export class ProjectCreationFailedError extends ProjectInitializationError {
  constructor(projectId: string, cause: Error) {
    super(projectId, `Failed to create project: ${cause.message}`, 'CREATING_PROJECT', false)
  }
}

export class TemplateLoadFailedError extends ProjectInitializationError {
  constructor(projectId: string, templateId: string, cause: Error) {
    super(projectId, `Failed to load template ${templateId}: ${cause.message}`, 'LOADING_TEMPLATE', true)
  }
}

export class EnvironmentCreationFailedError extends ProjectInitializationError {
  constructor(projectId: string, cause: Error) {
    super(projectId, `Failed to create environments: ${cause.message}`, 'CREATING_ENVIRONMENTS', true)
  }
}

export class RepositorySetupFailedError extends ProjectInitializationError {
  constructor(projectId: string, cause: Error) {
    super(projectId, `Failed to setup repository: ${cause.message}`, 'SETTING_UP_REPOSITORY', true)
  }
}

export class FinalizationFailedError extends ProjectInitializationError {
  constructor(projectId: string, cause: Error) {
    super(projectId, `Failed to finalize project: ${cause.message}`, 'FINALIZING', false)
  }
}
```

### 错误处理策略

```typescript
@Injectable()
export class ProjectInitializationStateMachine {
  private async transition(context: InitializationContext): Promise<void> {
    try {
      const handler = this.getHandler(context.currentState)
      await handler.execute(context)
      context.currentState = this.getNextState(context)
    } catch (error) {
      this.logger.error(`Step ${context.currentState} failed:`, error)
      
      // 分类错误
      const classified = this.classifyError(error, context.currentState)
      
      // 记录详细日志
      await this.logError(context, classified)
      
      // 设置错误状态
      context.error = classified
      context.currentState = 'FAILED'
      
      // 事务会自动回滚
      throw classified
    }
  }
  
  private classifyError(error: unknown, step: InitializationState): ProjectInitializationError {
    if (error instanceof ProjectInitializationError) {
      return error
    }
    
    // 根据步骤和错误类型分类
    const message = error instanceof Error ? error.message : String(error)
    
    switch (step) {
      case 'CREATING_PROJECT':
        return new ProjectCreationFailedError('', error as Error)
      case 'LOADING_TEMPLATE':
        return new TemplateLoadFailedError('', '', error as Error)
      case 'CREATING_ENVIRONMENTS':
        return new EnvironmentCreationFailedError('', error as Error)
      case 'SETTING_UP_REPOSITORY':
        return new RepositorySetupFailedError('', error as Error)
      case 'FINALIZING':
        return new FinalizationFailedError('', error as Error)
      default:
        return new ProjectInitializationError('', message, step)
    }
  }
}
```

## 测试策略

### 单元测试
- FinalizeHandler的成员添加逻辑
- CreateEnvironmentsHandler的智能判断逻辑
- 错误分类逻辑
- 返回值构建逻辑

### 集成测试
- 完整的项目创建流程(无模板)
- 使用模板创建项目
- 使用有环境定义的模板
- 并发创建相同项目
- 事务回滚验证

### 属性测试
- 使用fast-check库
- 每个属性运行100次迭代
- 生成随机的项目数据、模板配置
- 在不同步骤注入失败,验证回滚

## 实施计划

### 阶段1: 核心重构 (优先级1)
1. 扩展InitializationResult接口
2. 重构FinalizeHandler
3. 简化ProjectsService.create()
4. 添加事务支持

### 阶段2: 智能化 (优先级2)
1. 重构CreateEnvironmentsHandler
2. 增强错误处理
3. 优化返回值

### 阶段3: 反馈机制 (优先级3)
1. GitOps状态跟踪
2. 超时处理
3. 重试机制

### 阶段4: 测试 (贯穿始终)
1. 单元测试
2. 集成测试
3. 属性测试
