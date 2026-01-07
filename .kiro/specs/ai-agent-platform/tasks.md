# 实施计划：AI Agent 平台

## 概述

本实施计划将 AI Agent 平台设计分解为可执行的编码任务，按照 Phase 1-5 的顺序逐步实现。每个任务都是独立的、可测试的代码变更。

## 任务列表

### Phase 1: 基础 Agent + 平台工具 (MVP)

- [x] 1. 项目结构和依赖设置
  - [x] 1.1 创建 Agent 模块目录结构
    - 在 `packages/services/extensions/src/ai/` 下创建 `agent/` 目录
    - 创建子目录: `graphs/`, `mcp/`, `memory/`, `observability/`
    - _Requirements: 目录结构预览_
  - [x] 1.2 安装核心依赖
    - 添加 `@langchain/langgraph`, `@modelcontextprotocol/sdk`, `langfuse` 到 package.json
    - 配置 TypeScript 类型
    - _Requirements: 新增依赖_
  - [x] 1.3 创建数据库 Schema
    - 创建 `agent_executions` 表
    - 创建 `agent_checkpoints` 表
    - 创建 `tool_call_logs` 表
    - 运行数据库迁移
    - _Requirements: 数据模型_

- [x] 2. LangGraph 核心框架
  - [x] 2.1 实现 AgentState 类型定义
    - 创建 `agent/types/state.types.ts`
    - 定义 AgentState, DevOpsAgentState, SREAgentState 接口
    - _Requirements: 1.2_
  - [x] 2.2 实现 GraphExecutor 服务
    - 创建 `agent/executor/graph-executor.service.ts`
    - 实现 execute() 方法，支持状态传递
    - 实现 resumeFromCheckpoint() 方法
    - _Requirements: 1.2, 1.6, 1.7_
  - [ ]* 2.3 编写 Property 1 属性测试：状态机状态传递不变性
    - **Property 1: 状态机状态传递不变性**
    - **Validates: Requirements 1.2**
  - [ ]* 2.4 编写 Property 2 属性测试：检查点 Round-Trip
    - **Property 2: 检查点序列化 Round-Trip**
    - **Validates: Requirements 1.6, 1.7**
  - [x] 2.5 实现条件路由支持
    - 在 GraphExecutor 中添加条件边处理
    - _Requirements: 1.4_
  - [ ]* 2.6 编写 Property 3 属性测试：条件路由正确性
    - **Property 3: 条件路由正确性**
    - **Validates: Requirements 1.4**
  - [x] 2.7 实现重试策略
    - 创建 `agent/executor/retry-strategy.ts`
    - 实现指数退避算法
    - _Requirements: 1.3_
  - [ ]* 2.8 编写 Property 4 属性测试：重试策略指数退避
    - **Property 4: 重试策略指数退避**
    - **Validates: Requirements 1.3**

- [x] 3. Checkpoint - 确保所有测试通过
  - 运行 `bun test` 确保 Phase 1 基础框架测试通过
  - Agent 模块类型检查通过，无诊断错误
  - 如有问题请询问用户

- [x] 4. MCP Server 实现
  - [x] 4.1 实现 MCPServer 核心类
    - 创建 `agent/mcp/mcp-server.ts`
    - 实现 registerTool(), listTools(), callTool() 方法
    - 实现 JSON Schema 参数验证
    - _Requirements: 2.1, 2.2, 2.6, 2.7_
  - [ ]* 4.2 编写 Property 5 属性测试：MCP 工具注册/发现一致性
    - **Property 5: MCP 工具注册/发现一致性**
    - **Validates: Requirements 2.1, 2.2**
  - [ ]* 4.3 编写 Property 6 属性测试：MCP 参数验证正确性
    - **Property 6: MCP 参数验证正确性**
    - **Validates: Requirements 2.6, 2.7**
  - [x] 4.4 实现工具执行超时
    - 添加超时配置和处理逻辑
    - _Requirements: 2.8_
  - [ ]* 4.5 编写 Property 7 属性测试：工具执行超时
    - **Property 7: 工具执行超时**
    - **Validates: Requirements 2.8**
  - [x] 4.6 实现工具调用审计日志
    - 集成 tool_call_logs 表
    - 记录所有工具调用
    - _Requirements: 2.9_
  - [ ]* 4.7 编写 Property 8 属性测试：工具调用审计完整性
    - **Property 8: 工具调用审计完整性**
    - **Validates: Requirements 2.9**

- [x] 5. K8s MCP 工具
  - [x] 5.1 实现 K8s 工具集
    - 创建 `agent/mcp/tools/k8s.tool.ts`
    - 实现 k8s_get_pods, k8s_scale_deployment, k8s_get_logs, k8s_rollback
    - 桥接到现有 K8sClientService
    - _Requirements: 2.3_
  - [ ]* 5.2 编写 K8s 工具单元测试
    - 测试参数验证
    - 测试权限检查
    - _Requirements: 2.3_

- [x] 6. Git MCP 工具
  - [x] 6.1 实现 Git 工具集
    - 创建 `agent/mcp/tools/git.tool.ts`
    - 实现 git_create_branch, git_commit, git_create_pr, git_merge_pr
    - 桥接到现有 Git 服务
    - _Requirements: 2.4_
  - [ ]* 6.2 编写 Git 工具单元测试
    - 测试参数验证
    - 测试权限检查
    - _Requirements: 2.4_

- [x] 7. Monitor MCP 工具
  - [x] 7.1 实现监控工具集
    - 创建 `agent/mcp/tools/monitor.tool.ts`
    - 实现 monitor_get_events, monitor_get_pod_metrics, monitor_get_deployment_status
    - 通过 K8s API 提供监控能力
    - _Requirements: 2.5_
  - [ ]* 7.2 编写监控工具单元测试
    - 测试参数验证
    - 测试查询逻辑
    - _Requirements: 2.5_

- [x] 8. Checkpoint - 确保 MCP 工具测试通过
  - Agent 模块类型检查通过，无诊断错误
  - 如有问题请询问用户

- [x] 9. 基础 DevOps Agent
  - [x] 9.1 实现 DevOps Agent Graph
    - 创建 `agent/graphs/devops-agent.graph.ts`
    - 定义节点: Reason → Plan → Execute → Review
    - 实现 DevOpsAgentState 状态管理
    - _Requirements: 3.1, 3.2_
  - [x] 9.2 实现任务规划节点
    - 创建 `agent/graphs/nodes/planning.node.ts`
    - 使用 AIService 生成执行计划
    - _Requirements: 3.2_
  - [x] 9.3 实现工具调用节点
    - 创建 `agent/graphs/nodes/tool-call.node.ts`
    - 集成 MCPServer 执行工具
    - _Requirements: 3.3_
  - [x] 9.4 实现人工审批节点
    - 创建 `agent/graphs/nodes/human-review.node.ts`
    - 实现审批暂停和恢复逻辑
    - _Requirements: 3.7_
  - [ ]* 9.5 编写 Property 15 属性测试：人工审批暂停
    - **Property 15: 人工审批暂停**
    - **Validates: Requirements 1.5, 3.7**
  - [ ]* 9.6 编写 DevOps Agent 集成测试
    - 测试完整执行流程
    - 测试错误恢复
    - _Requirements: 3.1-3.8_

- [x] 10. AgentService 入口
  - [x] 10.1 实现 AgentService
    - 创建 `agent/agent.service.ts`
    - 实现 execute(), resume(), cancel(), submitApproval(), getHistory()
    - _Requirements: 10.1-10.7_
  - [x] 10.2 实现流式输出
    - 添加 AsyncIterable<AgentEvent> 支持
    - _Requirements: 1.8, 10.2_
  - [ ]* 10.3 编写 Property 16 属性测试：流式输出顺序性
    - **Property 16: 流式输出顺序性**
    - **Validates: Requirements 1.8, 3.8, 10.2**

- [x] 11. 与现有 AI 服务集成
  - [x] 11.1 集成 AIService
    - 在 Agent 节点中使用 AIService 进行 LLM 调用
    - _Requirements: 7.1_
  - [x] 11.2 集成 RAGService
    - 在规划节点中使用 RAGService 检索上下文
    - _Requirements: 7.2_
  - [x] 11.3 集成 FunctionCallingService
    - 作为 MCP 工具的桥接层
    - _Requirements: 7.3_
  - [x] 11.4 集成 ContentFilterService
    - 在输入/输出处添加安全过滤
    - _Requirements: 7.4_
  - [x] 11.5 集成 UsageTrackingService
    - 添加配额检查和使用量记录
    - _Requirements: 7.5_
  - [ ]* 11.6 编写 Property 17 属性测试：现有服务集成不变性
    - **Property 17: 现有服务集成不变性**
    - **Validates: Requirements 7.1-7.7**

- [x] 12. tRPC API 端点
  - [x] 12.1 创建 Agent Router
    - 创建 `apps/api-gateway/src/routers/agent.router.ts`
    - 实现 chat, execute, cancel, history, approve 端点
    - _Requirements: 10.1-10.7_
  - [ ]* 12.2 编写 API 端点测试
    - 测试请求/响应格式
    - 测试权限检查
    - _Requirements: 10.1-10.7_

- [x] 13. Checkpoint - Phase 1 完成
  - 后端构建全部通过
  - DevOps Agent 基本功能已实现
  - 前端有预先存在的错误（与 AI Agent 无关）

### Phase 2: 任务规划 + 自主执行

- [x] 14. 复杂任务分解
  - [x] 14.1 实现任务分解器
    - 创建 `agent/planning/task-decomposer.ts`
    - 使用 LLM 将复杂任务分解为子任务
    - _Requirements: 3.2_
  - [ ]* 14.2 编写任务分解单元测试
    - 测试分解逻辑
    - 测试边界情况
    - _Requirements: 3.2_

- [x] 15. 多步骤执行
  - [x] 15.1 实现步骤执行器
    - 创建 `agent/executor/step-executor.ts`
    - 支持顺序和并行执行
    - _Requirements: 3.3_
  - [x] 15.2 实现进度跟踪
    - 添加步骤进度事件
    - _Requirements: 3.8_

- [x] 16. 错误恢复和重试
  - [x] 16.1 实现错误分类
    - 创建 `agent/errors/agent-errors.ts`
    - 定义 ToolExecutionError, PermissionDeniedError 等
    - _Requirements: 3.4_
  - [x] 16.2 实现恢复策略
    - 根据错误类型选择恢复策略
    - _Requirements: 3.4, 3.5_
  - [ ]* 16.3 编写错误恢复测试
    - 测试各种错误场景
    - 测试恢复逻辑
    - _Requirements: 3.4, 3.5_

- [x] 17. Checkpoint - Phase 2 完成
  - 类型检查通过
  - 复杂任务分解、多步骤执行、错误恢复已实现

### Phase 3: 记忆系统 + 自学习

- [x] 18. Mem0 集成
  - [x] 18.1 实现 MemoryService
    - 创建 `agent/memory/memory.service.ts`
    - 实现 add(), search(), getByUser(), delete(), cleanup()
    - 集成 Mem0 SDK
    - _Requirements: 5.1, 5.8_
  - [ ]* 18.2 编写 Property 9 属性测试：记忆存储 Round-Trip
    - **Property 9: 记忆存储 Round-Trip**
    - **Validates: Requirements 5.1, 5.8**
  - [x] 18.3 实现记忆范围隔离
    - 按 userId, projectId, organizationId 隔离
    - _Requirements: 5.3_
  - [ ]* 18.4 编写 Property 10 属性测试：记忆范围隔离
    - **Property 10: 记忆范围隔离**
    - **Validates: Requirements 5.3**
  - [x] 18.5 实现语义搜索
    - 使用向量嵌入进行相似度搜索
    - _Requirements: 5.5_
  - [ ]* 18.6 编写 Property 11 属性测试：记忆搜索相似度排序
    - **Property 11: 记忆搜索相似度排序**
    - **Validates: Requirements 5.5**
  - [x] 18.7 实现记忆过期清理
    - 添加过期时间和清理任务
    - _Requirements: 5.6_
  - [ ]* 18.8 编写 Property 12 属性测试：记忆过期清理
    - **Property 12: 记忆过期清理**
    - **Validates: Requirements 5.6**

- [x] 19. 自动事实提取
  - [x] 19.1 实现事实提取器
    - 创建 `agent/memory/fact-extractor.ts`
    - 使用 LLM 从对话中提取重要事实
    - _Requirements: 5.4_
  - [ ]* 19.2 编写事实提取测试
    - 测试提取准确性
    - _Requirements: 5.4_

- [x] 20. 决策历史学习
  - [x] 20.1 实现决策记录
    - 存储 Agent 决策上下文
    - _Requirements: 5.7_
  - [x] 20.2 实现决策检索
    - 在新决策时检索相似历史决策
    - _Requirements: 5.2_

- [x] 21. Checkpoint - Phase 3 完成
  - 记忆系统核心功能已实现
  - MemoryService, FactExtractor, DecisionHistoryService 已完成
  - 属性测试为可选任务

### Phase 4: 预测性运维

- [x] 22. SRE Agent 实现
  - [x] 22.1 实现 SRE Agent Graph
    - 创建 `agent/graphs/sre-agent.graph.ts`
    - 定义节点: AlertReceive → Analyze → Diagnose → Remediate → Report
    - _Requirements: 4.1-4.8_
  - [x] 22.2 实现告警接收节点
    - 创建 `agent/graphs/nodes/alert-receive.node.ts`
    - 接收和解析告警数据
    - _Requirements: 4.1, 4.2_
  - [x] 22.3 实现诊断节点
    - 创建 `agent/graphs/nodes/diagnose.node.ts`
    - 查询指标和日志
    - 生成诊断报告
    - _Requirements: 4.3, 4.4_
  - [x] 22.4 实现修复节点
    - 创建 `agent/graphs/nodes/remediate.node.ts`
    - 基于历史模式建议修复
    - 执行安全的自动修复
    - _Requirements: 4.5, 4.6_
  - [x] 22.5 实现升级逻辑
    - 创建 `agent/graphs/nodes/escalate.node.ts`
    - 低置信度或高风险时升级给人工
    - _Requirements: 4.7_
  - [x] 22.6 实现事件时间线
    - 在所有节点中记录操作到时间线
    - _Requirements: 4.8_
  - [ ]* 22.7 编写 SRE Agent 集成测试
    - 测试告警响应流程
    - 测试自动修复
    - _Requirements: 4.1-4.8_

- [x] 23. Checkpoint - Phase 4 完成
  - SRE Agent Graph 已实现
  - 告警接收、诊断、修复、升级节点已完成
  - 事件时间线记录已集成
  - 集成测试为可选任务

### Phase 5: 多 Agent 协作

- [x] 24. Agent 团队定义
  - [x] 24.1 实现 Agent 注册表
    - 创建 `agent/registry/agent-registry.ts`
    - 支持注册和发现专业 Agent
    - _Requirements: 9.1_
  - [ ]* 24.2 编写注册表测试
    - 测试注册和发现
    - _Requirements: 9.1_

- [x] 25. Agent 间通信
  - [x] 25.1 实现消息总线
    - 创建 `agent/communication/message-bus.ts`
    - 支持 Agent 间消息传递
    - _Requirements: 9.2_
  - [ ]* 25.2 编写消息总线测试
    - 测试消息传递
    - _Requirements: 9.2_

- [x] 26. Orchestrator Agent
  - [x] 26.1 实现 Orchestrator Agent Graph
    - 创建 `agent/graphs/orchestrator-agent.graph.ts`
    - 实现任务委派和结果聚合
    - _Requirements: 9.3, 9.5_
  - [x] 26.2 实现并行执行
    - 支持独立子任务并行执行
    - _Requirements: 9.4_
  - [x] 26.3 实现冲突解决
    - 处理 Agent 矛盾建议
    - _Requirements: 9.6_
  - [x] 26.4 实现共享上下文
    - 维护所有 Agent 可访问的上下文
    - _Requirements: 9.7_
  - [ ]* 26.5 编写 Orchestrator Agent 集成测试
    - 测试多 Agent 协作
    - 测试冲突解决
    - _Requirements: 9.1-9.7_

- [x] 27. Checkpoint - Phase 5 完成
  - Agent 注册表、消息总线、Orchestrator Agent 已实现
  - 类型检查通过，无诊断错误
  - 集成测试为可选任务

### 可观测性和安全

- [x] 28. Langfuse 集成
  - [x] 28.1 实现 TracingService
    - 创建 `agent/observability/tracing.service.ts`
    - 实现 createTrace(), createSpan(), logGeneration(), score()
    - _Requirements: 6.1-6.8_
  - [ ]* 28.2 编写 Property 14 属性测试：追踪数据完整性
    - **Property 14: 追踪数据完整性**
    - **Validates: Requirements 6.2, 6.3, 6.4**
  - [x] 28.3 集成 Pino 日志
    - 添加追踪 ID 关联
    - _Requirements: 6.6_
  - [x] 28.4 实现成本追踪
    - 按用户、项目、Agent 类型统计
    - _Requirements: 6.7_

- [x] 29. 安全与权限
  - [x] 29.1 实现权限检查
    - 在工具调用前验证用户权限
    - _Requirements: 8.1, 8.2_
  - [ ]* 29.2 编写 Property 13 属性测试：权限检查一致性
    - **Property 13: 权限检查一致性**
    - **Validates: Requirements 8.1, 8.2, 8.3**
  - [x] 29.3 实现工具级权限配置
    - 支持细粒度权限控制
    - _Requirements: 8.3_
  - [x] 29.4 实现权限审计日志
    - 记录所有权限检查
    - _Requirements: 8.4_
  - [x] 29.5 实现速率限制
    - 按用户和工具限制调用频率
    - _Requirements: 8.6_
  - [x] 29.6 实现输入清理
    - 防止提示注入攻击
    - _Requirements: 8.7_
  - [ ]* 29.7 编写安全测试
    - 测试权限检查
    - 测试输入清理
    - _Requirements: 8.1-8.7_

- [x] 30. 最终 Checkpoint
  - Phase 1-5 核心功能已实现
  - 可观测性 (TracingService) 已实现
  - 安全模块 (PermissionService, RateLimiterService, InputSanitizerService) 已实现
  - 类型检查通过，无诊断错误
  - 属性测试和集成测试为可选任务

## 注意事项

- 任务标记 `*` 的为可选测试任务，可以跳过以加快 MVP 开发
- 每个 Checkpoint 都是验证点，确保之前的功能正常工作
- 属性测试使用 fast-check 库，每个测试运行 100 次迭代
- 所有代码使用 TypeScript 严格模式，避免 any 类型
