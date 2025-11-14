# 实施任务列表

- [x] 1. 修复前端数据传递和验证
  - 统一 `ProjectWizard.vue` 中的仓库配置数据结构
  - 添加表单验证逻辑，确保必填字段完整
  - 改进 `useProjects.ts` 的错误处理和用户提示
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. 重构后端项目初始化流程
- [x] 2.1 简化 ProjectOrchestrator 的初始化逻辑
  - 将 `createAndInitialize` 方法重构为 3 个清晰的路径
  - 提取 `createProjectRecord` 方法
  - 添加 `initializeWithRepository` 方法处理无模板场景
  - 添加 `markAsActive` 方法统一状态更新
  - 添加 `handleInitializationError` 方法统一错误处理
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.2 改进初始化状态跟踪
  - 在每个关键步骤添加状态更新
  - 添加 `currentAction` 字段提供用户友好的进度描述
  - 发布状态更新事件用于实时通知
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. 优化 OAuth 令牌处理
  - 改进 `resolveAccessToken` 方法的错误提示
  - 添加令牌过期检查
  - 避免重复调用令牌解析
  - 提供清晰的用户指引（如何连接 OAuth 账户）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. 重构仓库创建和关联逻辑
- [x] 4.1 统一仓库处理接口
  - 重构 `handleRepository` 方法，统一错误处理
  - 提取 `connectExistingRepository` 方法
  - 提取 `createNewRepositoryAndConnect` 方法
  - 改进 `parseRepositoryUrl` 方法的 URL 解析
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4.2 添加 GitProvider 服务验证方法
  - 实现 `validateRepository` 方法验证仓库可访问性
  - 统一 `createRepository` 接口
  - 改进 GitHub/GitLab API 调用的错误处理
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4.3 改进初始代码推送逻辑
  - 将 `pushInitialAppCode` 失败设为非致命错误
  - 推送失败时发送通知给用户
  - 记录详细的错误日志
  - _Requirements: 4.4_

- [x] 5. 完善错误处理和回滚机制
  - 确保所有错误都经过 `handleInitializationError` 处理
  - 验证 `rollbackResources` 方法正确清理所有资源
  - 添加回滚失败的日志记录
  - 改进错误信息的用户友好性
  - _Requirements: 2.5, 4.2, 4.3_

- [x] 6. 更新类型定义
  - 更新 `InitializationStatus` 类型，添加 `currentAction` 字段
  - 确保 `CreateProjectWithTemplateInput` 类型定义完整
  - _Requirements: 1.1, 2.1, 5.1_

- [ ] 7. 测试和验证
- [ ] 7.1 手动测试所有创建场景
  - 测试使用模板创建项目（包含仓库）
  - 测试无模板但有仓库创建项目
  - 测试创建空项目
  - 测试使用 OAuth 令牌
  - 测试使用手动令牌
  - 测试关联现有仓库
  - 测试创建新仓库
  - _Requirements: 1.1-5.5_

- [ ] 7.2 测试错误场景
  - 测试 OAuth 账户不存在
  - 测试仓库 URL 无效
  - 测试访问令牌无效
  - 测试仓库创建失败
  - 测试网络错误
  - 验证回滚机制正确执行
  - _Requirements: 2.5, 3.2, 4.2, 4.3_

- [ ]* 7.3 编写单元测试
  - 为 `ProjectOrchestrator` 编写单元测试
  - 为 `resolveAccessToken` 编写测试
  - 为 `handleRepository` 编写测试
  - 为错误处理逻辑编写测试
  - _Requirements: 2.1-5.5_
