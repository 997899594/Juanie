# 后端模块化 Monorepo - 任务列表

## Phase 1: 立即改进（1-2周）

### 1. 创建共享配置包

- [x] 1.1 创建 TypeScript 配置包
  - 创建 `packages/config/typescript/` 目录
  - 创建 `base.json` 配置文件
  - 创建 `node.json` 配置文件
  - 创建 `package.json`
  - _需求: 1.1, 6.1_

- [x] 1.2 创建 Vitest 配置包
  - 创建 `packages/config/vitest/` 目录
  - 创建 `vitest.config.ts` 基础配置
  - 创建 `package.json`
  - _需求: 1.1, 5.4_

### 2. 创建核心数据库包

- [x] 2.1 创建 core/database 包结构
  - 创建 `packages/core/database/` 目录
  - 创建 `src/schemas/` 目录
  - 创建 `package.json` 和 `tsconfig.json`
  - _需求: 1.1_

- [x] 2.2 迁移数据库 schemas
  - 复制所有 schema 文件从 `apps/api/src/database/schemas/` 到 `packages/core/database/src/schemas/`
  - 创建 `src/schemas/index.ts` 导出所有 schemas
  - 更新 import 路径
  - _需求: 1.1_

- [x] 2.3 创建数据库客户端
  - 创建 `src/client.ts` 文件
  - 迁移数据库连接逻辑
  - 导出数据库客户端和类型
  - _需求: 1.1_

- [x] 2.4 构建和测试 database 包
  - 运行 `bun run build`
  - 验证类型导出正确
  - 确保没有构建错误
  - _需求: 1.5_

- [x] 2.5 创建 DatabaseModule 在 core/database
  - 将 `apps/api-gateway/src/database/database.module.ts` 移到 `packages/core/database/src/database.module.ts`
  - 导出 DatabaseModule 供应用层使用
  - 更新 package.json 添加 NestJS 依赖
  - 更新 exports 字段包含 `/module`
  - _需求: 1.1, 6.4_

- [x] 2.6 更新应用层使用共享 DatabaseModule
  - 在 `apps/api-gateway` 中从 `@juanie/core-database/module` 导入
  - 删除本地的 `database/` 目录
  - 验证应用正常启动
  - _需求: 4.1, 4.2_

### 3. 创建核心类型包

- [x] 3.1 创建 core/types 包结构
  - 创建 `packages/core/types/` 目录
  - 创建 `src/` 目录
  - 创建 `package.json` 和 `tsconfig.json`
  - _需求: 1.1_

- [x] 3.2 提取共享类型
  - 创建 `src/models.ts` - 数据模型类型
  - 创建 `src/api.ts` - API 类型
  - 创建 `src/index.ts` - 导出所有类型
  - _需求: 1.1_

- [x] 3.3 构建 types 包
  - 运行 `bun run build`
  - 验证类型导出
  - _需求: 1.5_

### 4. 创建核心工具包

- [x] 4.1 创建 core/utils 包结构
  - 创建 `packages/core/utils/` 目录
  - 创建 `src/` 和 `test/` 目录
  - 创建 `package.json`、`tsconfig.json` 和 `vitest.config.ts`
  - _需求: 1.1_

- [x] 4.2 提取工具函数
  - 创建 `src/id.ts` - ID 生成
  - 创建 `src/date.ts` - 日期处理
  - 创建 `src/validation.ts` - 验证函数
  - 创建 `src/string.ts` - 字符串工具
  - 创建 `src/index.ts` - 导出
  - _需求: 1.1_

- [x] 4.3 编写工具函数测试
  - 为每个工具函数编写单元测试（32个测试全部通过）
  - 确保测试覆盖率 > 80%
  - _需求: 5.4_

- [x] 4.4 构建 utils 包
  - 运行 `bun run build`
  - 运行 `bun run test`
  - _需求: 1.5_

### 5. 更新 apps/api 使用核心包

- [x] 5.1 更新 apps/api 的 package.json
  - 添加 `@juanie/core-database: workspace:*`
  - 添加 `@juanie/core-types: workspace:*`
  - 添加 `@juanie/core-utils: workspace:*`
  - 运行 `bun install`
  - _需求: 4.1, 6.2_

- [x] 5.2 更新 database 导入
  - 替换所有 `@/database/schemas` 为 `@juanie/core-database/schemas`
  - 替换数据库客户端导入
  - _需求: 4.1_

- [x] 5.3 更新类型导入
  - 替换共享类型导入为 `@juanie/core-types`
  - _需求: 4.1_

- [x] 5.4 更新工具函数导入
  - 替换工具函数导入为 `@juanie/core-utils`
  - _需求: 4.1_

- [ ] 5.5 验证 apps/api 正常运行
  - 运行 `bun run type-check`
  - 运行 `bun run test`
  - 启动开发服务器验证
  - _需求: 4.2, 4.3_

### 6. 更新 Turborepo 配置

- [x] 6.1 更新 turbo.json
  - 添加 `build:packages` 任务
  - 配置任务依赖关系
  - 启用缓存
  - _需求: 5.1, 5.2_

- [x] 6.2 测试 Turborepo 构建
  - 运行 `turbo build`
  - 验证增量构建工作
  - 验证缓存生效（从 1.3s 降到 160ms，显示 FULL TURBO）
  - _需求: 5.2, 5.3_

### 7. 更新文档

- [x] 7.1 创建包开发指南
  - 文档化如何创建新包
  - 说明包命名规范
  - 说明依赖管理规则
  - 创建了 `docs/PACKAGE_DEVELOPMENT.md`
  - _需求: 7.2_

- [x] 7.2 更新开发环境文档
  - 创建 `apps/api/docs/development/SETUP.md`
  - 说明新的目录结构
  - 更新构建和测试命令
  - 更新根 README.md
  - _需求: 7.4_

## Phase 2: 短期改进（1-2月）

### 8. 创建 API Gateway 应用

- [x] 8.1 创建 api-gateway 目录结构
  - 创建 `apps/api-gateway/` 目录
  - 创建 `src/`、`test/` 目录
  - 创建 `package.json`、`tsconfig.json`
  - _需求: 3.1_

- [x] 8.2 设置 NestJS 基础
  - 创建 `src/main.ts` 入口文件
  - 创建 `src/app.module.ts` 根模块
  - 配置 Fastify 适配器
  - _需求: 3.1_

- [x] 8.3 创建 tRPC 配置
  - 创建 `src/trpc/trpc.service.ts`
  - 创建 `src/trpc/trpc.module.ts`
  - 配置 tRPC 中间件
  - _需求: 3.2, 3.5_

- [x] 8.4 创建路由聚合器
  - 创建 `src/trpc/trpc.router.ts`
  - 创建空的 `appRouter`
  - 导出 `AppRouter` 类型
  - _需求: 3.2, 3.3_

- [x] 8.5 配置可观测性
  - 创建 `src/observability/tracing.ts`
  - 创建 `src/observability/metrics.ts`
  - 集成到 main.ts
  - _需求: 3.1_

- [x] 8.6 测试 API Gateway 启动
  - 运行 `bun run dev`
  - 验证服务启动成功
  - 测试 health 端点
  - _需求: 3.1_

### 9. 提取 Auth 服务（第一个服务）

- [x] 9.1 创建 service-auth 包结构
  - 创建 `packages/services/auth/` 目录
  - 创建 `src/`、`test/`、`dto/` 目录
  - 创建 `package.json`、`tsconfig.json`、`vitest.config.ts`
  - _需求: 2.1, 2.8, 2.9_

- [x] 9.2 迁移 Auth Service
  - 复制 `apps/api/src/modules/auth/auth.service.ts`
  - 更新导入路径使用核心包
  - 调整依赖注入
  - _需求: 2.1_

- [x] 9.3 迁移 Auth Router
  - 复制 `apps/api/src/modules/auth/auth.router.ts`
  - 更新为独立的 tRPC 路由
  - 导出 `authRouter` 和类型
  - _需求: 2.1, 3.2_

- [x] 9.4 迁移 Auth Module
  - 复制 `apps/api/src/modules/auth/auth.module.ts`
  - 更新依赖
  - _需求: 2.1_

- [ ] 9.5 迁移 Auth 测试
  - 复制测试文件到 `test/`
  - 更新导入路径
  - 运行测试确保通过
  - _需求: 2.1, 5.4_

- [x] 9.6 构建 service-auth 包
  - 运行 `bun run build`
  - 验证导出正确
  - _需求: 2.9_

- [x] 9.7 集成到 API Gateway
  - 在 `api-gateway/package.json` 添加依赖
  - 在 `trpc.router.ts` 导入 `authRouter`
  - 添加到 `appRouter`
  - _需求: 3.2, 3.3_

- [x] 9.8 测试 Auth 服务
  - 启动 API Gateway
  - 测试所有 auth 端点
  - 验证行为与原 API 一致
  - _需求: 4.1, 4.3_

### 10. 提取 Organizations 服务

- [x] 10.1 创建 service-organizations 包
  - 创建目录结构
  - 创建配置文件
  - _需求: 2.2_

- [x] 10.2 迁移 Organizations 代码
  - 迁移 service、router、module
  - 更新导入路径
  - 添加对 `service-auth` 的依赖（如需要）
  - _需求: 2.2, 2.8_

- [ ] 10.3 迁移测试
  - 复制并更新测试
  - _需求: 2.2_

- [x] 10.4 构建并集成
  - 构建包
  - 集成到 API Gateway
  - 测试功能
  - _需求: 2.2, 3.2_

### 11. 提取 Teams 服务

- [x] 11.1 创建 service-teams 包
  - 创建目录结构
  - _需求: 2.3_

- [x] 11.2 迁移 Teams 代码
  - 迁移所有代码
  - 更新依赖
  - _需求: 2.3_

- [ ] 11.3 迁移测试
  - 复制并更新测试
  - _需求: 2.3_

- [x] 11.4 构建并集成
  - 构建包
  - 集成到 API Gateway
  - _需求: 2.3, 3.2_

### 12. 提取 Projects 服务

- [x] 12.1 创建 service-projects 包
  - 创建目录结构
  - _需求: 2.4_

- [x] 12.2 迁移 Projects 代码
  - 迁移所有代码
  - 更新依赖
  - _需求: 2.4_

- [ ] 12.3 迁移测试
  - 复制并更新测试
  - _需求: 2.4_

- [x] 12.4 构建并集成
  - 构建包
  - 集成到 API Gateway
  - _需求: 2.4, 3.2_

### 13. 提取 Pipelines 服务

- [x] 13.1 创建 service-pipelines 包
  - 创建目录结构
  - _需求: 2.5_

- [x] 13.2 迁移 Pipelines 代码
  - 迁移所有代码
  - 更新依赖
  - _需求: 2.5_

- [ ] 13.3 迁移测试
  - 复制并更新测试
  - _需求: 2.5_

- [x] 13.4 构建并集成
  - 构建包
  - 集成到 API Gateway
  - _需求: 2.5, 3.2_

### 14. 提取 Deployments 服务

- [x] 14.1 创建 service-deployments 包
  - 创建目录结构
  - _需求: 2.6_

- [x] 14.2 迁移 Deployments 代码
  - 迁移所有代码
  - 更新依赖
  - _需求: 2.6_

- [ ] 14.3 迁移测试
  - 复制并更新测试
  - _需求: 2.6_

- [x] 14.4 构建并集成
  - 构建包
  - 集成到 API Gateway
  - _需求: 2.6, 3.2_

### 15. 提取剩余服务

- [ ] 15.1 提取 AI Assistants 服务
  - 创建 `service-ai-assistants` 包
  - 迁移代码和测试
  - 集成到 Gateway
  - _需求: 2.7_

- [x] 15.2 提取 Storage 服务
  - 创建 `service-storage` 包
  - 迁移代码和测试
  - 集成到 Gateway
  - _需求: 2.7_

- [x] 15.3 提取 K3s 服务
  - 创建 `service-k3s` 包
  - 迁移代码和测试
  - 集成到 Gateway
  - _需求: 2.7_

- [ ] 15.4 提取 Ollama 服务
  - 创建 `service-ollama` 包
  - 迁移代码和测试
  - 集成到 Gateway
  - _需求: 2.7_

- [x] 15.5 提取其他服务 - Repositories（已完成）
  - ✅ Repositories - 已创建包并集成到 Gateway
  - ⏳ Environments - 待迁移
  - ⏳ Cost Tracking - 待迁移
  - ⏳ Security Policies - 待迁移
  - ⏳ Audit Logs - 待迁移
  - ⏳ Notifications - 待迁移
  - ⏳ Templates - 待迁移
  - ⏳ Users - 待迁移
  - _需求: 2.7_

### 16. 完整测试和验证

- [ ] 16.1 运行所有单元测试
  - 运行 `turbo test`
  - 确保所有测试通过
  - _需求: 4.3, 5.4_

- [ ] 16.2 运行集成测试
  - 测试服务间交互
  - 测试完整的用户流程
  - _需求: 4.3_

- [ ] 16.3 性能测试
  - 测试 API 响应时间
  - 对比迁移前后性能
  - _需求: 5.1, 5.2_

- [ ] 16.4 验证类型安全
  - 在前端测试 tRPC 类型推导
  - 确保没有类型错误
  - _需求: 3.5, 4.4_

### 17. 更新 CI/CD

- [ ] 17.1 更新 GitHub Actions
  - 更新构建步骤使用 Turborepo
  - 配置缓存
  - 只测试变更的包
  - _需求: 5.5_

- [ ] 17.2 更新 GitLab CI
  - 更新 `.gitlab-ci.yml`
  - 配置 Turborepo 缓存
  - _需求: 5.5_

- [ ] 17.3 测试 CI/CD 流程
  - 提交变更触发 CI
  - 验证构建和测试正常
  - 验证缓存工作
  - _需求: 5.5_

### 18. 清理和文档

- [ ] 18.1 清理旧代码
  - 删除 `apps/api/src/modules/` 中已迁移的模块
  - 保留 `apps/api` 作为备份（暂不删除）
  - _需求: 4.5_

- [ ] 18.2 更新架构文档
  - 更新 `ARCHITECTURE_ANALYSIS.md`
  - 创建新的架构图
  - _需求: 7.1_

- [ ] 18.3 创建迁移指南
  - 文档化迁移过程
  - 记录遇到的问题和解决方案
  - _需求: 4.5, 7.3_

- [ ] 18.4 更新开发文档
  - 更新所有相关文档
  - 添加新包的使用示例
  - _需求: 7.4_

- [ ] 18.5 创建故障排查指南
  - 常见问题和解决方案
  - 调试技巧
  - _需求: 7.5_

## 任务统计

- **Phase 1 总任务**: 7 个主任务，26 个子任务
- **Phase 2 总任务**: 11 个主任务，60+ 个子任务
- **所有任务必需**: 包括所有测试任务
- **预计工期**: 
  - Phase 1: 1-2 周
  - Phase 2: 1-2 月

## 执行建议

1. **Phase 1 必须完成**: 这是 Phase 2 的基础
2. **Phase 2 按服务顺序**: 从 Auth 开始，逐个迁移
3. **每个服务迁移后测试**: 确保功能正常再继续下一个
4. **保持 apps/api 运行**: 作为备份和对比
5. **所有测试必须完成**: 确保代码质量和测试覆盖率

## 下一步

完成 Phase 1 后，评估效果，然后开始 Phase 2。
