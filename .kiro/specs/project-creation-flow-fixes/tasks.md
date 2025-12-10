# 项目创建流程修复 - 实施任务

## 阶段1: 类型和接口定义

- [x] 1. 扩展InitializationResult和InitializationContext
  - 在`packages/services/business/src/projects/initialization/types.ts`中扩展接口
  - 添加`project?: ProjectWithRelations`到InitializationResult
  - 添加`errorStep?: InitializationState`到InitializationResult
  - 添加`projectWithRelations?: ProjectWithRelations`到InitializationContext
  - 添加`tx?: DatabaseTransaction`到InitializationContext
  - 定义ProjectWithRelations接口
  - _需求: 1.2, 6.1, 6.2_

- [x] 2. 创建项目初始化错误类型
  - 在`packages/core/src/errors/business-errors.ts`中添加错误类
  - 创建ProjectInitializationError基类(包含projectId, step, retryable)
  - 创建ProjectCreationFailedError
  - 创建TemplateLoadFailedError
  - 创建EnvironmentCreationFailedError
  - 创建RepositorySetupFailedError
  - 创建FinalizationFailedError
  - 导出所有错误类型
  - _需求: 7.1, 7.2, 7.5_

## 阶段2: FinalizeHandler重构

- [x] 3. 重构FinalizeHandler
  - 修改`packages/services/business/src/projects/initialization/handlers/finalize.handler.ts`
  - 添加addProjectOwner方法(从ProjectsService移过来)
  - 添加logAuditTrail方法(从ProjectsService移过来)
  - 添加loadCompleteProject方法(查询完整项目对象)
  - 在execute中调用这些方法
  - 将完整项目对象保存到context.projectWithRelations
  - _需求: 1.3, 1.4, 6.1, 6.2_

## 阶段3: CreateEnvironmentsHandler智能化

- [x] 4. 重构CreateEnvironmentsHandler
  - 修改`packages/services/business/src/projects/initialization/handlers/create-environments.handler.ts`
  - 更新canHandle方法:检查模板是否定义environments
  - 在execute中检查是否已存在环境
  - 如果模板已创建环境,使用现有环境ID
  - 如果没有环境,创建默认环境
  - _需求: 3.1, 3.2, 3.3, 3.4_

## 阶段4: 状态机事务支持

- [x] 5. 添加事务支持到状态机
  - 修改`packages/services/business/src/projects/initialization/state-machine.ts`
  - 在execute方法中使用db.transaction包裹整个流程
  - 将事务对象注入到context.tx
  - 更新所有handler使用context.tx而不是直接使用db
  - 添加错误分类逻辑classifyError方法
  - 失败时自动回滚事务
  - _需求: 2.1, 2.2, 2.3_

- [x] 6. 更新所有Handler使用事务
  - 修改CreateProjectHandler使用context.tx
  - 修改LoadTemplateHandler使用context.tx (不需要数据库)
  - 修改RenderTemplateHandler使用context.tx
  - 修改CreateEnvironmentsHandler使用context.tx
  - 修改FinalizeHandler使用context.tx
  - _需求: 2.1_

## 阶段5: ProjectsService简化

- [x] 7. 简化ProjectsService.create()
  - 修改`packages/services/business/src/projects/projects.service.ts`
  - 删除成员添加逻辑(已移到FinalizeHandler)
  - 删除审计日志逻辑(已移到FinalizeHandler)
  - 删除项目查询逻辑(orchestrator直接返回)
  - 直接返回result.project
  - 更新错误处理,使用新的错误类型
  - _需求: 1.1, 1.2, 6.4_

## 阶段6: ProjectOrchestrator返回值优化

- [x] 8. 更新ProjectOrchestrator返回完整对象
  - 修改`packages/services/business/src/projects/project-orchestrator.service.ts`
  - 确保返回result包含project字段
  - 确保返回result包含errorStep字段(失败时)
  - _需求: 1.2, 6.1, 6.5_

## 阶段7: 错误处理增强

- [x] 9. 增强状态机错误处理
  - 在state-machine.ts中添加logError方法
  - 记录详细的错误日志(包含步骤、上下文)
  - 区分临时错误和永久错误
  - 为可重试错误设置retryable标识
  - _需求: 7.2, 7.3, 7.4, 7.5_

## 阶段8: 类型检查和清理

- [x] 10. 类型检查
  - 运行`bun run type-check`
  - 修复所有类型错误
  - 确保InitializationResult类型正确传播
  - _需求: All_

- [x] 11. 代码清理
  - 删除ProjectsService中的旧代码注释
  - 更新相关文档
  - 确保所有导入正确
  - _需求: All_

## 阶段9: 验证和文档

- [x] 12. 类型检查验证
  - ✅ 运行 `bun run type-check` 通过
  - ✅ 所有类型定义正确
  - ✅ 无类型错误
  - _需求: All_

- [x] 13. 更新文档
  - ✅ 创建迁移文档 `docs/troubleshooting/refactoring/project-creation-flow-fixes.md`
  - ✅ 记录所有实施细节
  - ✅ 记录新的错误类型
  - ✅ 记录事务支持
  - ✅ 记录架构改进
  - _需求: All_

## 实施完成 ✅

所有核心任务已完成:
- ✅ 类型定义扩展
- ✅ 错误类型层次
- ✅ FinalizeHandler 重构
- ✅ CreateEnvironmentsHandler 智能化
- ✅ 状态机事务支持
- ✅ ProjectsService 简化
- ✅ 类型检查通过
- ✅ 文档更新完成

**待手动验证**:
- [ ] 创建项目(无模板)
- [ ] 创建项目(使用模板)
- [ ] 创建项目(使用有环境定义的模板)
- [ ] 验证错误处理
- [ ] 验证事务回滚
