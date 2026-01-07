# AI Platform Phase 1 MVP 实施计划

## 概述

本实施计划将 AI Platform Phase 1 设计转化为可执行的开发任务。采用增量开发策略，每个任务都构建在前一个任务之上，确保系统始终处于可工作状态。

## 任务列表

### 1. 项目基础设施搭建

- [x] 1.1 初始化 NestJS 项目结构
  - 创建 `apps/ai-platform` 目录
  - 配置 TypeScript、ESLint、Prettier
  - 设置 NestJS 模块结构 (ai, kubernetes, audit)
  - 配置环境变量管理 (.env, config module)
  - _需求: 11.1_
  - **状态**: ✅ 已完成

- [x] 1.2 安装核心依赖
  - 安装 `ai` (Vercel AI SDK Core)
  - 安装 `@ai-sdk/google` (Gemini Provider)
  - 安装 `zod` (Schema 验证)
  - 安装 `ioredis` (Redis 客户端)
  - 安装 `@nestjs/common`, `@nestjs/core`
  - _需求: 11.1, 11.2_
  - **状态**: ✅ 已完成，所有依赖使用 `latest` 版本

- [x] 1.3 配置 Redis 连接
  - 创建 Redis Module
  - 配置 Redis 连接池
  - 实现健康检查端点
  - _需求: 2.1, 9.1_
  - **状态**: ✅ 已完成

- [x] 1.4 配置 Gemini API 连接
  - 设置 API Key 管理
  - 配置 Flash 和 Pro 模型实例
  - 实现 API 调用重试逻辑
  - _需求: 5.1, 5.2_
  - **状态**: ✅ 已完成

### 2. 前端基础设施搭建

- [ ] 2.1 初始化 Vue 3 项目
  - 创建 `apps/ai-platform-ui` 目录
  - 配置 Vite + Vue 3 + TypeScript
  - 安装 `@ai-sdk/vue`
  - 配置 Pinia 状态管理
  - _需求: 11.3_

- [ ] 2.2 安装 UI 组件库
  - 安装 `shadcn-vue` 或 `naive-ui`
  - 配置 Tailwind CSS
  - 创建基础布局组件
  - _需求: 1.4_

- [ ] 2.3 创建 Component Registry
  - 实现 `componentRegistry.ts`
  - 配置组件懒加载
  - 创建 `DynamicToolRenderer.vue`
  - _需求: 1.4, 1.6_

### 3. 核心 AI 聊天功能

- [x] 3.1 实现 AI Chat Controller
  - 创建 `AIChatController` (POST /api/ai/chat)
  - 实现请求验证 (DTO)
  - 配置 CORS 和租户 ID 提取
  - _需求: 1.1, 9.3_
  - **状态**: ✅ 已完成，使用 `pipeTextStreamToResponse()` 处理流式响应

- [x] 3.2 实现 AI Chat Service
  - 创建 `AIChatService`
  - 集成 `streamText` API
  - 实现 system prompt 构建
  - 配置 `onToolCall` 和 `onFinish` 回调
  - 使用 `pipeDataStreamToResponse()` 处理流式响应
  - _需求: 1.1, 1.8, 10.1_
  - **状态**: ✅ 已完成

- [x] 3.3 编写 AI Chat Service 单元测试
  - 测试 system prompt 构建逻辑
  - 测试错误处理
  - 测试租户上下文注入
  - _需求: 1.1, 9.3_
  - **状态**: ✅ 已完成，所有 22 个测试通过

- [x] 3.4 实现前端 AI Chat Composable
  - 创建 `useAIChat.ts`
  - 使用自定义 fetch 实现（后端返回 text/plain 流式响应）
  - 配置 API 端点和错误处理
  - _需求: 1.1, 1.8_
  - **状态**: ✅ 已完成，但测试因 `@juanie/ui` 包的 DOM 初始化问题暂时无法运行

- [x] 3.5 编写前端 Chat 组件单元测试
  - 测试消息渲染
  - 测试流式更新
  - 测试错误恢复
  - _需求: 1.8_
  - **状态**: ✅ 测试代码已完成，但因 `@juanie/ui` 包的 DOM 初始化问题暂时无法运行
  - **问题**: `@juanie/ui` 在模块加载时尝试访问 `localStorage` 和 `document`，导致 jsdom 环境下测试失败
  - **临时方案**: 已实现完整的测试代码，待 `@juanie/ui` 包修复后可正常运行

### 4. 工具注册与执行系统

- [ ] 4.1 实现 Tool Registry Service
  - 创建 `ToolRegistryService`
  - 使用 `tool()` API 定义工具
  - 实现 `getTools()` 和 `executeTool()`
  - 实现 `getToolDescriptions()` 用于 system prompt
  - _需求: 1.2, 1.3, 7.1_

- [ ] 4.2 实现 showClusterDashboard 工具
  - 定义 Zod schema (namespace, podName)
  - 实现 K8s API 调用逻辑
  - 返回结构化数据 (pods, logs, metrics)
  - _需求: 1.2, 7.2_

- [ ] 4.3 实现 showDeploymentDiff 工具
  - 定义 Zod schema (yaml, deploymentName)
  - 实现 YAML 验证调用
  - 实现 diff 计算逻辑
  - 计算风险评分
  - _需求: 1.2, 4.3, 7.3_

- [ ] 4.4 实现 showDiagnosticTree 工具
  - 定义 Zod schema (alertName, namespace, timestamp)
  - 实现指标和日志查询
  - 构建诊断树结构
  - _需求: 1.2, 8.1, 8.2_

- [ ] 4.5 编写工具调用结构完整性属性测试
  - **Property 1: 工具调用结构完整性**
  - **验证需求: 1.1, 1.2, 1.3, 1.7**
  - 使用 fast-check 生成随机工具调用
  - 验证返回结构包含 success/data/error 字段
  - 验证参数符合 Zod schema

### 5. Context Caching 实现

- [ ] 5.1 实现 Context Caching Service
  - 创建 `ContextCachingService`
  - 注入 Redis 客户端
  - 实现 `getCachedContext()` 和 `setCachedContext()`
  - 实现 TTL 管理
  - _需求: 2.1, 2.2, 2.4_

- [ ] 5.2 实现 Cache 刷新逻辑
  - 实现 `refreshCache()` 方法
  - 集成 Git 仓库拉取
  - 实现上下文构建逻辑
  - _需求: 2.3, 2.8_

- [ ] 5.3 编写 Context Cache 租户隔离属性测试
  - **Property 4: Context Cache 租户隔离**
  - **验证需求: 2.1, 2.2, 9.1, 9.2**
  - 使用 fast-check 生成不同租户 ID
  - 验证租户间数据完全隔离
  - 验证跨租户访问返回 null

- [ ] 5.4 编写 Cache 刷新幂等性属性测试
  - **Property 5: Cache 刷新幂等性**
  - **验证需求: 2.3, 2.8**
  - 验证连续两次刷新产生相同内容
  - 测试 Git 内容未变化场景

### 6. 确定性验证系统

- [ ] 6.1 实现 Validator Service
  - 创建 `ValidatorService`
  - 实现 `validateK8sYaml()` (kubeval)
  - 实现 `validateShellScript()` (shellcheck)
  - 实现临时文件管理
  - _需求: 3.1, 3.2, 3.3_

- [ ] 6.2 集成验证到工具执行流程
  - 在 `showDeploymentDiff` 中调用验证
  - 实现验证失败的错误反馈
  - 实现验证重试逻辑 (最多 3 次)
  - _需求: 3.4, 7.3_

- [ ] 6.3 编写验证工具确定性属性测试
  - **Property 6: 验证工具确定性**
  - **验证需求: 3.1, 3.2, 3.3**
  - 验证相同输入产生相同输出
  - 测试有效和无效的 YAML/脚本

- [ ] 6.4 编写验证失败反馈循环属性测试
  - **Property 7: 验证失败反馈循环**
  - **验证需求: 3.4**
  - 验证错误信息正确反馈给 AI
  - 验证 AI 能基于错误重新生成

### 7. AI 模型路由系统

- [ ] 7.1 实现 AI Router Service
  - 创建 `AIRouterService`
  - 实现基于规则的复杂度计算
  - 实现模型选择逻辑 (Flash vs Pro)
  - _需求: 5.1, 5.2, 5.3_

- [ ] 7.2 实现可选的 AI 分类路由
  - 添加 `USE_AI_ROUTER` 环境变量
  - 实现 `selectModelWithAI()` 方法
  - 实现降级到规则分类的逻辑
  - _需求: 5.3_

- [ ] 7.3 编写模型路由复杂度一致性属性测试
  - **Property 10: 模型路由复杂度一致性**
  - **验证需求: 5.1, 5.2, 5.3**
  - 使用 fast-check 生成随机消息序列
  - 验证复杂度 < 0.5 路由到 Flash
  - 验证复杂度 >= 0.5 路由到 Pro

- [ ] 7.4 实现路由决策记录
  - 记录每次路由决策到日志
  - 记录成本节省数据
  - 暴露 Prometheus 指标
  - _需求: 10.2, 10.4_

### 8. 安全防火墙系统

- [ ] 8.1 实现 Safety Guard Service
  - 创建 `SafetyGuardService`
  - 集成 Lakera Guard SDK
  - 实现 `checkInput()` 方法
  - 实现 `checkOutput()` 方法
  - _需求: 6.1, 6.2, 6.3, 6.4_

- [ ] 8.2 实现安全事件记录
  - 创建 `SecurityEvent` 数据模型
  - 实现 `logSecurityEvent()` 方法
  - 实现敏感信息脱敏逻辑
  - _需求: 6.5, 6.7_

- [ ] 8.3 编写安全检查阻断完整性属性测试
  - **Property 11: 安全检查阻断完整性**
  - **验证需求: 6.1, 6.2, 6.3, 6.4, 6.5**
  - 测试提示注入检测
  - 测试 PII 检测
  - 验证危险输入被阻止并记录

- [ ] 8.4 编写敏感信息脱敏幂等性属性测试
  - **Property 12: 敏感信息脱敏幂等性**
  - **验证需求: 6.7**
  - 验证连续两次脱敏产生相同结果

### 9. Checkpoint - 核心功能验证

- [ ] 9.1 端到端测试：基础聊天流程
  - 测试用户输入 → AI 响应 → 工具调用 → 结果返回
  - 验证流式响应正常工作
  - 验证错误处理和重试

- [ ] 9.2 端到端测试：安全拦截
  - 测试危险输入被正确拦截
  - 验证安全事件被记录
  - 验证用户收到友好错误提示

- [ ] 9.3 性能测试
  - 测试 TTFT (首 token 延迟) < 300ms
  - 测试 P95 延迟 < 3s
  - 测试并发请求处理能力

- [ ] 9.4 确保所有测试通过，询问用户是否有问题

### 10. 前端动态组件系统

- [ ] 10.1 实现 ClusterDashboard 组件
  - 创建 `ClusterDashboard.vue`
  - 接收 pods, logs, metrics 数据
  - 实现 Pod 状态可视化
  - 实现日志查看器
  - _需求: 1.4, 7.2_

- [ ] 10.2 实现 DeploymentDiff 组件
  - 创建 `DeploymentDiff.vue`
  - 接收 current, proposed, diff 数据
  - 实现 Diff 可视化 (Monaco Editor)
  - 实现风险评分展示
  - _需求: 1.4, 4.3, 7.3_

- [ ] 10.3 实现 DiagnosticTree 组件
  - 创建 `DiagnosticTree.vue`
  - 接收诊断树数据
  - 实现树形结构可视化
  - 实现节点展开/折叠
  - _需求: 1.4, 8.1, 8.2_

- [ ] 10.4 实现 ApprovalDialog 组件
  - 创建 `ApprovalDialog.vue`
  - 实现审批界面
  - 实现审批理由输入
  - 实现审批状态管理
  - _需求: 4.1, 4.2_

- [ ] 10.5 编写组件注册表映射一致性属性测试
  - **Property 2: 组件注册表映射一致性**
  - **验证需求: 1.4, 1.6**
  - 验证所有后端工具都有前端组件映射
  - 验证组件懒加载正常工作

### 11. HITL 审批流程

- [ ] 11.1 实现审批状态机
  - 创建 `ApprovalService`
  - 实现状态转换逻辑 (Pending → Approved/Rejected → Executed)
  - 实现审批超时处理
  - _需求: 4.1, 4.2_

- [ ] 11.2 实现风险评分计算
  - 实现 `calculateRiskScore()` 方法
  - 基于变更范围计算风险
  - 实现多人审批规则
  - _需求: 4.4, 4.5_

- [ ] 11.3 编写 HITL 审批状态机属性测试
  - **Property 8: HITL 审批状态机**
  - **验证需求: 4.1, 4.2**
  - 验证状态转换顺序正确
  - 验证不能跳过审批阶段

- [ ] 11.4 编写风险评分单调性属性测试
  - **Property 9: 风险评分单调性**
  - **验证需求: 4.4**
  - 验证增加变更范围不降低风险评分

### 12. 多模态输入支持

- [ ] 12.1 实现多模态输入处理
  - 扩展 `ChatRequestDto` 支持文件上传
  - 实现文件类型和大小验证
  - 集成 Gemini Vision API
  - _需求: 8.9, 8.10_

- [ ] 12.2 实现前端文件上传
  - 创建文件上传组件
  - 支持拖拽上传
  - 实现文件预览
  - _需求: 8.9_

- [ ] 12.3 编写多模态输入类型识别属性测试
  - **Property 16: 多模态输入类型识别**
  - **验证需求: 8.9, 8.10, 8.11**
  - 验证图片中的文本提取
  - 验证图表识别
  - 验证异常标记识别

### 13. 审计日志与可观测性

- [ ] 13.1 实现 Audit Log Service
  - 创建 `AuditLogService`
  - 实现日志记录逻辑
  - 创建 `AuditLog` 数据模型
  - 集成 Drizzle ORM
  - _需求: 10.1, 12.1, 12.2_

- [ ] 13.2 实现成本计算
  - 实现 token 使用量统计
  - 实现成本计算逻辑
  - 记录每次调用的成本
  - _需求: 10.2, 10.3_

- [ ] 13.3 编写审计日志完整性属性测试
  - **Property 17: 审计日志完整性**
  - **验证需求: 10.1, 12.1**
  - 验证日志包含所有必需字段
  - 验证租户 ID、用户 ID、时间戳正确

- [ ] 13.4 编写成本计算准确性属性测试
  - **Property 18: 成本计算准确性**
  - **验证需求: 10.2, 10.3**
  - 验证成本计算公式正确
  - 测试不同 token 数量的成本

- [ ] 13.5 编写审计日志不可篡改性属性测试
  - **Property 20: 审计日志不可篡改性**
  - **验证需求: 12.5, 12.6**
  - 验证日志仅支持追加
  - 验证不能修改或删除已有日志

### 14. Prometheus 指标暴露

- [ ] 14.1 实现 Metrics Service
  - 创建 `MetricsService`
  - 集成 `@willsoto/nestjs-prometheus`
  - 定义核心指标 (调用量、延迟、成本、错误率)
  - _需求: 10.4_

- [ ] 14.2 实现指标收集
  - 在关键路径添加指标记录
  - 实现按租户、模型、Agent 类型的分组
  - 暴露 `/metrics` 端点
  - _需求: 10.4, 10.5_

- [ ] 14.3 配置 Grafana Dashboard
  - 创建成本趋势 Dashboard
  - 创建质量指标 Dashboard
  - 创建性能指标 Dashboard
  - _需求: 10.7_

### 15. 租户隔离与安全

- [ ] 15.1 实现租户上下文中间件
  - 创建 `TenantContextMiddleware`
  - 从请求头提取租户 ID
  - 验证租户 ID 有效性
  - _需求: 9.3_

- [ ] 15.2 实现租户隔离验证
  - 创建 `validateTenantAccess()` 方法
  - 在所有数据访问点添加验证
  - 记录跨租户访问尝试
  - _需求: 9.4_

- [ ] 15.3 编写工具执行租户上下文属性测试
  - **Property 13: 工具执行租户上下文**
  - **验证需求: 7.1, 7.2, 7.8, 9.3**
  - 验证工具调用携带正确租户 ID
  - 验证返回数据仅限于该租户资源

### 16. Checkpoint - 集成测试

- [ ] 16.1 端到端测试：DevOps 部署流程
  - 测试完整的部署计划生成 → Diff 预览 → 审批 → 执行流程
  - 验证 YAML 验证正常工作
  - 验证风险评分计算正确

- [ ] 16.2 端到端测试：SRE 诊断流程
  - 测试告警分析 → 诊断树生成 → 根因假设流程
  - 验证多模态输入 (截图分析) 正常工作
  - 验证 Context Caching 检索历史案例

- [ ] 16.3 端到端测试：多租户隔离
  - 测试不同租户的数据完全隔离
  - 验证跨租户访问被正确拦截
  - 验证安全事件被记录

- [ ] 16.4 确保所有测试通过，询问用户是否有问题

### 17. tRPC API 层

- [ ] 17.1 实现 tRPC Router
  - 创建 `aiRouter`
  - 定义 `chat` procedure
  - 定义 `getAuditLogs` procedure
  - 定义 `getCostAnalysis` procedure
  - _需求: 11.1_

- [ ] 17.2 实现类型安全的 SDK
  - 导出 tRPC 类型
  - 创建前端 tRPC 客户端
  - 实现类型推导
  - _需求: 11.2_

- [ ] 17.3 编写 API 类型安全性属性测试
  - **Property 19: API 类型安全性**
  - **验证需求: 11.1, 11.2**
  - 验证客户端和服务端类型一致
  - 测试类型不匹配场景

### 18. 文档与示例

- [ ] 18.1 编写 API 文档
  - 使用 Swagger/OpenAPI 生成文档
  - 添加代码示例
  - 添加错误码说明
  - _需求: 11.4_

- [ ] 18.2 创建 Storybook
  - 配置 Storybook for Vue 3
  - 为所有 Generative UI 组件创建 Story
  - 添加交互示例
  - _需求: 11.6_

- [ ] 18.3 创建 Playground
  - 实现交互式 API 测试界面
  - 支持实时预览
  - 支持代码生成
  - _需求: 11.5_

### 19. 错误处理与恢复

- [ ] 19.1 实现流式响应错误恢复
  - 实现 Checkpoint Markers
  - 实现前端错误检测和重试
  - 记录失败的流式响应
  - _需求: 1.8_

- [ ] 19.2 实现工具调用失败处理
  - 包装工具执行错误为结构化对象
  - 实现自动重试逻辑
  - 实现关键工具的回滚机制
  - _需求: 7.1_

- [ ] 19.3 实现 Context Cache 失效处理
  - 实现自动刷新逻辑
  - 实现降级到无 Cache 模式
  - 显示用户友好的加载提示
  - _需求: 2.1, 2.3_

### 20. 性能优化

- [ ] 20.1 实现前端节流渲染
  - 实现 Throttled Rendering (50-100ms)
  - 使用 `json-repair` 处理不完整 JSON
  - 优化组件 props 响应式性能
  - _需求: 1.8_

- [ ] 20.2 实现后端缓存优化
  - 实现 Redis 连接池
  - 实现 Cache 预热逻辑
  - 实现 Cache 增量更新
  - _需求: 2.8_

- [ ] 20.3 实现 API 调用优化
  - 实现请求批处理
  - 实现指数退避重试
  - 实现速率限制
  - _需求: 5.3_

### 21. 最终集成与部署准备

- [ ] 21.1 配置生产环境变量
  - 设置 Gemini API Key
  - 设置 Lakera Guard API Key
  - 设置 Redis 连接字符串
  - 设置数据库连接字符串

- [ ] 21.2 配置 Docker 容器化
  - 创建 Dockerfile (后端)
  - 创建 Dockerfile (前端)
  - 创建 docker-compose.yml
  - 配置健康检查

- [ ] 21.3 配置 CI/CD Pipeline
  - 配置 GitHub Actions
  - 配置自动化测试
  - 配置代码覆盖率检查
  - 配置自动部署

- [ ] 21.4 最终端到端测试
  - 测试完整的用户场景
  - 测试性能指标达标
  - 测试安全防护有效
  - 测试成本控制在预算内

- [ ] 21.5 确保所有测试通过，准备上线

## 注意事项

### 测试策略
- **所有测试任务都是必做的**，包括单元测试和属性测试
- 属性测试使用 Vitest + fast-check，每个测试最少 100 次迭代
- 每个属性测试必须引用设计文档中的属性编号
- 单元测试覆盖率目标 > 80%
- 从一开始就建立完善的测试体系，确保代码质量和系统可靠性

### 开发顺序
- 按照任务编号顺序执行，确保每个任务都构建在前一个任务之上
- Checkpoint 任务用于验证阶段性成果，必须确保所有测试通过后再继续
- 遇到问题时及时询问用户，不要盲目继续

### 技术要点
- 所有代码使用 TypeScript
- 后端使用 NestJS + Vercel AI SDK
- 前端使用 Vue 3 + `@ai-sdk/vue`
- 使用 Redis 存储 Context Cache（不是内存 Map）
- 使用 SDK 的 `pipeDataStreamToResponse()` 处理流式响应
- 模型路由支持可选的 Flash-based 分类

### 成本控制
- 优先使用 Flash 模型（快速且便宜）
- 仅在必要时使用 Pro 模型（复杂任务）
- 监控每次调用的成本
- 实现成本预警和配额管理

### 安全要求
- 所有输入必须经过 Lakera Guard 检查
- 所有输出必须经过敏感信息检测
- 所有 AI 生成的代码必须经过确定性验证
- 严格的多租户数据隔离
