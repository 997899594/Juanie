# 项目创建统一化 - 实现任务

## 任务列表

- [x] 1. 类型系统重构
  - 重命名和统一项目创建输入类型
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 1.1 重命名 CreateProjectWithTemplateInputType 为 CreateProjectInput
  - 在 `packages/types/src/project.types.ts` 中重命名接口
  - 更新接口注释，移除"仅用于类型参考"说明
  - _Requirements: 2.1, 2.2_

- [x] 1.2 删除旧的 CreateProjectInput 类型
  - 在 `packages/types/src/schemas.ts` 中删除旧类型导出
  - 删除对应的 Zod schema（如果有单独的简单版本）
  - _Requirements: 2.3, 4.2_

- [x] 1.3 更新所有类型导入
  - 在 `packages/services/business/src/projects/projects.service.ts` 中更新导入
  - 在 `apps/api-gateway/src/routers/projects.router.ts` 中更新导入
  - 搜索并更新所有其他引用
  - _Requirements: 2.3_

- [x] 2. ProjectOrchestrator 增强
  - 支持最小化项目创建（无模板/仓库）
  - _Requirements: 1.2, 3.1_

- [x] 2.1 添加默认环境创建逻辑
  - 在 `ProjectOrchestrator.createAndInitialize()` 中添加条件
  - 当没有 templateId 时，创建默认的 development 环境
  - _Requirements: 3.1_

- [x] 2.2 优化可选步骤处理
  - 确保模板应用是可选的（只在 templateId 存在时执行）
  - 确保仓库连接是可选的（只在 repository 存在时执行）
  - 确保 GitOps 设置是可选的（只在 repository 存在时执行）
  - _Requirements: 1.2, 1.3, 3.2, 3.3_

- [ ]* 2.3 编写单元测试
  - 测试最小化创建（无模板/仓库）
  - 测试模板创建
  - 测试仓库创建
  - 测试完整创建（模板 + 仓库）
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. ProjectsService 重构
  - 删除条件分支，统一使用 orchestrator
  - _Requirements: 1.1, 1.4, 4.1_

- [x] 3.1 删除简单创建路径
  - 删除 `if (extendedData.templateId || extendedData.repository)` 条件
  - 删除 else 分支中的所有代码
  - _Requirements: 1.1, 4.1_

- [x] 3.2 统一使用 orchestrator
  - 所有创建请求都调用 `orchestrator.createAndInitialize()`
  - 移除类型守卫 `const extendedData = data as CreateProjectWithTemplateInputType`
  - 简化参数传递
  - _Requirements: 1.1, 1.2, 1.3, 2.3_

- [x] 3.3 保持成员添加和审计日志
  - 确保创建者自动添加为 owner
  - 确保审计日志正确记录
  - _Requirements: 3.4, 3.5_

- [x] 3.4 删除向后兼容注释
  - 删除所有包含"向后兼容"、"backward compatibility"的注释
  - 删除"简单创建"相关注释
  - _Requirements: 4.4_

- [ ]* 3.5 编写属性测试
  - **Property 1: Single path** - 所有创建都使用 orchestrator
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [ ]* 3.6 编写属性测试
  - **Property 3: Functionality preserved** - 所有场景功能正常
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 4. API 层更新
  - 更新路由使用统一类型
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 4.1 更新 projects.router.ts
  - 使用统一的 CreateProjectInput 类型
  - 更新 Zod schema 验证
  - 删除类型转换逻辑
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]* 4.2 测试 API 端点
  - 测试简单创建 API
  - 测试模板创建 API
  - 测试仓库创建 API
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5. 前端更新
  - 确保前端使用统一接口
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5.1 检查 ProjectWizard 组件
  - 验证组件使用统一的输入类型
  - 确保所有必需字段都提供
  - 确保可选字段正确处理
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 5.2 检查 useProjects composable
  - 验证 composable 使用统一类型
  - 确保类型定义正确
  - _Requirements: 6.1_

- [x] 5.3 删除条件逻辑
  - 删除前端中针对不同创建模式的条件逻辑
  - 统一为单一创建流程
  - _Requirements: 6.4_

- [x] 6. 测试和验证
  - 确保所有功能正常工作
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6.1 运行单元测试
  - 运行 ProjectsService 测试
  - 运行 ProjectOrchestrator 测试
  - 确保所有测试通过
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 6.2 运行属性测试
  - 运行所有属性测试
  - 验证正确性属性
  - _Requirements: 1.1, 3.1, 3.2, 3.3_

- [x] 6.3 手动测试所有场景
  - 测试简单项目创建
  - 测试模板项目创建
  - 测试仓库项目创建
  - 测试完整项目创建
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 6.4 验证审计日志
  - 检查所有场景的审计日志
  - 确保元数据正确
  - _Requirements: 3.5_

- [x] 7. 最终清理和文档
  - 删除冗余代码和注释
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7.1 代码清理
  - 删除未使用的导入
  - 删除未使用的类型
  - 删除调试代码
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 7.2 注释清理
  - 删除所有"向后兼容"注释
  - 删除"TODO"注释（如果已完成）
  - 更新过时的注释
  - _Requirements: 4.4_

- [x] 7.3 更新文档
  - 更新 API 文档
  - 更新架构文档
  - 创建迁移总结文档
  - _Requirements: All_

- [x] 8. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
