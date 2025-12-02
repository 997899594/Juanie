# Implementation Plan

## Phase 1: 项目成员权限同步（MVP）

- [x] 1. 数据库 Schema 和类型定义
  - 创建 user_git_accounts 表
  - 创建 git_sync_logs 表
  - 添加类型定义到 @juanie/types
  - _Requirements: 5.4, 6.1_

- [x] 2. Git 账号关联功能
  - 实现 GitAccountLinkingService
  - 实现 OAuth 连接流程（GitHub）
  - 实现 OAuth 连接流程（GitLab）
  - 添加 Token 加密存储
  - _Requirements: 5.2, 5.3, 5.4, 1.4_

- [x] 3. 扩展 GitProviderService
  - 添加 addCollaborator() 方法（GitHub）
  - 添加 addCollaborator() 方法（GitLab）
  - 添加 removeCollaborator() 方法（GitHub）
  - 添加 removeCollaborator() 方法（GitLab）
  - 添加 updateCollaboratorPermission() 方法
  - 添加 listCollaborators() 方法
  - _Requirements: 4.2, 4.7, 4.8, 6.4_

- [x] 4. 权限映射工具函数
  - 实现 mapProjectRoleToGitPermission() 函数
  - 添加单元测试验证映射正确性
  - _Requirements: 4.3, 4.4, 4.5, 4.6_

- [x] 5. Git 同步服务
  - 创建 GitSyncService
  - 实现 syncProjectMember() 方法
  - 实现 removeMemberAccess() 方法
  - 集成队列处理（BullMQ）
  - 实现队列 Worker 处理同步任务
  - _Requirements: 4.2, 4.8, 7.2_

- [x] 6. 错误处理和重试机制
  - 实现错误分类（认证、网络、速率限制、冲突）
  - 实现指数退避重试策略
  - 记录同步日志到 git_sync_logs 表
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 6.2_

- [x] 7. 集成到项目成员管理
  - 修改 ProjectMembersService.addMember()
  - 修改 ProjectMembersService.removeMember()
  - 修改 ProjectMembersService.updateMemberRole()
  - 添加事件监听器触发同步
  - _Requirements: 4.2, 4.7, 4.8_

- [x] 8. API 路由和 tRPC
  - 添加 linkGitAccount mutation
  - 添加 getGitAccountStatus query
  - 添加 unlinkGitAccount mutation
  - 添加 retrySyncMember mutation
  - _Requirements: 5.2, 5.5, 6.6_

- [x] 9. 前端 UI 组件
  - 创建 GitAccountLinking 组件
  - 创建 GitSyncStatus 组件
  - 在项目成员列表显示同步状态
  - 添加重试同步按钮
  - _Requirements: 5.1, 5.5, 6.4, 6.6_

- [x] 10. Checkpoint - 确保所有功能正常
  - 手动测试完整流程
  - 确认所有 API 正常工作
  - 确认 UI 显示正确
  - 询问用户是否有问题

## Phase 2: 组织级同步

- [x] 11. 扩展 organizations 表
  - 添加 Git 平台同步字段
  - 创建数据库迁移
  - _Requirements: 2.3_

- [x] 12. 扩展 GitProviderService（组织）
  - 添加 createOrganization() 方法（GitHub）
  - 添加 createOrganization() 方法（GitLab）
  - 添加 addOrgMember() 方法
  - 添加 removeOrgMember() 方法
  - _Requirements: 2.1, 2.2, 4.1_

- [x] 13. 组织同步逻辑
  - 实现组织创建时的 Git 组织同步
  - 实现组织成员同步
  - 实现 mapOrgRoleToGitPermission() 函数
  - _Requirements: 2.1, 2.2, 2.5, 4.1, 4.3_

- [x] 14. 组织同步 UI
  - 在组织创建流程添加 Git 同步选项
  - 显示 Git 组织链接
  - 显示组织同步状态
  - _Requirements: 2.6, 6.4_

- [x] 15. Checkpoint - 确保组织同步正常
  - 手动测试组织创建和同步
  - 确认成员权限正确
  - 询问用户是否有问题

## Phase 3: 双向同步和高级功能

- [x] 16. Webhook 接收和验证
  - 实现 Webhook 接收端点
  - 实现 Webhook 签名验证（GitHub）
  - 实现 Webhook 签名验证（GitLab）
  - _Requirements: 8.1, 8.5_

- [x] 17. Git 平台变更同步
  - 处理仓库删除事件
  - 处理协作者变更事件
  - 处理仓库设置变更事件
  - _Requirements: 8.2, 8.3, 8.4_

- [x] 18. 冲突检测和解决
  - 实现冲突检测逻辑
  - 以平台权限为准同步到 Git
  - 记录冲突日志
  - _Requirements: 8.3_

- [ ] 19. 批量同步功能
  - 实现批量同步 API
  - 实现同步进度追踪
  - 生成同步报告
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [ ] 20. Token 自动刷新
  - 实现定时检查 Token 过期
  - 实现自动刷新逻辑
  - 刷新失败时通知用户
  - _Requirements: 10.3_

- [ ] 21. 同步监控和报告
  - 添加同步监控面板
  - 显示失败的同步任务
  - 提供批量重试功能
  - _Requirements: 6.4, 6.5, 6.6_

- [ ] 22. Final Checkpoint - 完整测试
  - 测试所有同步场景
  - 测试错误处理和恢复
  - 性能测试
  - 询问用户是否满意
