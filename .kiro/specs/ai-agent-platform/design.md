# 设计文档：AI Agent 平台

## 概述

本设计文档描述 AI Agent 平台的技术架构，将现有 12 个 AI 服务整合为统一的、具备自主决策能力的 Agent 系统。

### 设计目标

1. **组合而非重构** - 复用现有 AI 服务，新增 Agent 层
2. **标准化工具协议** - 通过 MCP 暴露平台能力
3. **有状态工作流** - 使用 LangGraph 状态机管理复杂任务
4. **跨会话记忆** - 通过 Mem0 实现长期上下文保持
5. **全链路可观测** - 通过 Langfuse 追踪所有 Agent 执行

### 技术选型

| 组件 | 技术 | 版本 |
|------|------|------|
| Agent 框架 | LangGraph.js | ^0.2.x |
| 工具协议 | MCP SDK | ^1.x |
| 记忆系统 | Mem0 | ^0.1.x |
| 可观测性 | Langfuse | ^3.x |
| LLM 调用 | Vercel AI SDK (现有) | 4.x |
| 向量数据库 | Qdrant (现有) | - |

## 架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           API Layer (tRPC)                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  AgentRouter: chat, execute, cancel, history, approve           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Agent Orchestration Layer                         │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │   AgentService   │  │  GraphExecutor   │  │ CheckpointStore  │       │
│  │  (入口协调器)    │  │  (状态机执行)    │  │  (检查点持久化)  │       │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │
│           │                     │                     │                  │
│           └─────────────────────┼─────────────────────┘                  │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    LangGraph StateGraph                          │    │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐       │    │
│  │  │ Reason  │───▶│ Plan    │───▶│ Execute │───▶│ Review  │       │    │
│  │  │  Node   │    │  Node   │    │  Node   │    │  Node   │       │    │
│  │  └─────────┘    └─────────┘    └────┬────┘    └─────────┘       │    │
│  │                                     │                            │    │
│  │                              ┌──────▼──────┐                     │    │
│  │                              │ Tool Call   │                     │    │
│  │                              │    Node     │                     │    │
│  │                              └─────────────┘                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│    MCP Server        │ │   Memory Layer   │ │  Observability       │
│  ┌────────────────┐  │ │  ┌────────────┐  │ │  ┌────────────────┐  │
│  │ Tool Registry  │  │ │  │   Mem0     │  │ │  │   Langfuse     │  │
│  │ ─────────────  │  │ │  │  Service   │  │ │  │   Tracing      │  │
│  │ • K8s Tools    │  │ │  └────────────┘  │ │  └────────────────┘  │
│  │ • Git Tools    │  │ │                  │ │                      │
│  │ • Monitor Tools│  │ │                  │ │                      │
│  └────────────────┘  │ └──────────────────┘ └──────────────────────┘
└──────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Existing AI Services (复用)                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │AIService│ │RAGService│ │Function │ │Content  │ │ Usage   │           │
│  │         │ │         │ │Calling  │ │Filter   │ │Tracking │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Agent 类型架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent Registry                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  BaseAgent (抽象基类)                                            │    │
│  │  • graph: StateGraph                                             │    │
│  │  • tools: MCPTool[]                                              │    │
│  │  • systemPrompt: string                                          │    │
│  │  • execute(input): AsyncIterable<AgentEvent>                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              ▲                                           │
│              ┌───────────────┼───────────────┐                          │
│              │               │               │                          │
│  ┌───────────┴───┐  ┌───────┴───────┐  ┌───┴───────────┐               │
│  │  DevOpsAgent  │  │   SREAgent    │  │ OrchestratorAgent │            │
│  │  ───────────  │  │  ──────────   │  │  ──────────────   │            │
│  │  • 部署任务   │  │  • 告警响应   │  │  • 任务委派       │            │
│  │  • 回滚操作   │  │  • 根因分析   │  │  • 结果聚合       │            │
│  │  • CI/CD 集成 │  │  • 自动修复   │  │  • 冲突解决       │            │
│  └───────────────┘  └───────────────┘  └─────────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

### MCP 工具架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MCP Server                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Protocol Handler                                                │    │
│  │  • tools/list → 返回工具定义                                     │    │
│  │  • tools/call → 执行工具调用                                     │    │
│  │  • resources/list → 返回资源列表                                 │    │
│  │  • resources/read → 读取资源内容                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│              ┌───────────────┼───────────────┐                          │
│              ▼               ▼               ▼                          │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │  K8s Tools    │  │  Git Tools    │  │ Monitor Tools │               │
│  │  ──────────   │  │  ─────────    │  │  ────────────  │               │
│  │  • getPods    │  │  • createBranch│ │  • queryMetrics│               │
│  │  • scaleDeploy│  │  • commit     │  │  • getAlerts   │               │
│  │  • getLogs    │  │  • createPR   │  │  • getEvents   │               │
│  │  • rollback   │  │  • mergePR    │  │  • getTraces   │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  FunctionCallingService Bridge (现有服务桥接)                    │    │
│  │  • 将 MCP 工具调用转换为 FunctionCallingService 执行             │    │
│  │  • 复用现有的参数验证和执行逻辑                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## 组件与接口

### 核心服务接口


#### AgentService (入口协调器)

```typescript
/**
 * Agent 服务 - 统一入口
 * 
 * 职责:
 * - 接收用户请求，路由到合适的 Agent
 * - 管理 Agent 生命周期
 * - 协调检查点和恢复
 */
interface AgentService {
  /**
   * 执行 Agent 任务
   * @param input - 用户输入
   * @param options - 执行选项
   * @returns 事件流
   */
  execute(
    input: AgentInput,
    options: AgentExecutionOptions
  ): AsyncIterable<AgentEvent>

  /**
   * 从检查点恢复执行
   * @param checkpointId - 检查点 ID
   * @returns 事件流
   */
  resume(checkpointId: string): AsyncIterable<AgentEvent>

  /**
   * 取消执行
   * @param executionId - 执行 ID
   */
  cancel(executionId: string): Promise<void>

  /**
   * 提交人工审批
   * @param executionId - 执行 ID
   * @param decision - 审批决定
   */
  submitApproval(
    executionId: string,
    decision: ApprovalDecision
  ): Promise<void>

  /**
   * 获取执行历史
   * @param userId - 用户 ID
   * @param options - 查询选项
   */
  getHistory(
    userId: string,
    options: HistoryQueryOptions
  ): Promise<AgentExecution[]>
}
```

#### GraphExecutor (状态机执行器)

```typescript
/**
 * LangGraph 状态机执行器
 * 
 * 职责:
 * - 构建和执行 StateGraph
 * - 管理节点间状态传递
 * - 处理条件路由
 */
interface GraphExecutor<TState extends AgentState> {
  /**
   * 执行图
   * @param graph - StateGraph 实例
   * @param initialState - 初始状态
   * @param config - 执行配置
   */
  execute(
    graph: StateGraph<TState>,
    initialState: TState,
    config: GraphConfig
  ): AsyncIterable<GraphEvent<TState>>

  /**
   * 从检查点恢复
   * @param graph - StateGraph 实例
   * @param checkpoint - 检查点数据
   */
  resumeFromCheckpoint(
    graph: StateGraph<TState>,
    checkpoint: Checkpoint<TState>
  ): AsyncIterable<GraphEvent<TState>>
}
```

#### MCPServer (工具协议服务器)

```typescript
/**
 * MCP 协议服务器
 * 
 * 职责:
 * - 实现 MCP 协议规范
 * - 管理工具注册和发现
 * - 执行工具调用
 */
interface MCPServer {
  /**
   * 注册工具
   * @param tool - 工具定义
   */
  registerTool(tool: MCPTool): void

  /**
   * 获取所有工具定义
   */
  listTools(): MCPToolDefinition[]

  /**
   * 调用工具
   * @param name - 工具名称
   * @param args - 参数
   * @param context - 调用上下文
   */
  callTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolCallContext
  ): Promise<ToolCallResult>

  /**
   * 注册资源
   * @param resource - 资源定义
   */
  registerResource(resource: MCPResource): void

  /**
   * 读取资源
   * @param uri - 资源 URI
   */
  readResource(uri: string): Promise<ResourceContent>
}
```

#### MemoryService (记忆服务)

```typescript
/**
 * Mem0 记忆服务
 * 
 * 职责:
 * - 存储和检索对话记忆
 * - 自动提取重要事实
 * - 支持语义搜索
 */
interface MemoryService {
  /**
   * 添加记忆
   * @param content - 记忆内容
   * @param metadata - 元数据
   */
  add(
    content: string,
    metadata: MemoryMetadata
  ): Promise<Memory>

  /**
   * 搜索相关记忆
   * @param query - 搜索查询
   * @param scope - 搜索范围
   * @param limit - 结果数量
   */
  search(
    query: string,
    scope: MemoryScope,
    limit?: number
  ): Promise<Memory[]>

  /**
   * 获取用户记忆
   * @param userId - 用户 ID
   * @param options - 查询选项
   */
  getByUser(
    userId: string,
    options?: MemoryQueryOptions
  ): Promise<Memory[]>

  /**
   * 删除记忆
   * @param memoryId - 记忆 ID
   */
  delete(memoryId: string): Promise<void>

  /**
   * 清理过期记忆
   * @param scope - 清理范围
   * @param olderThan - 过期时间
   */
  cleanup(
    scope: MemoryScope,
    olderThan: Date
  ): Promise<number>
}
```

#### TracingService (追踪服务)

```typescript
/**
 * Langfuse 追踪服务
 * 
 * 职责:
 * - 创建和管理追踪
 * - 记录 LLM 调用和工具调用
 * - 计算成本和延迟
 */
interface TracingService {
  /**
   * 创建追踪
   * @param name - 追踪名称
   * @param metadata - 元数据
   */
  createTrace(
    name: string,
    metadata: TraceMetadata
  ): Trace

  /**
   * 创建 Span
   * @param trace - 父追踪
   * @param name - Span 名称
   * @param type - Span 类型
   */
  createSpan(
    trace: Trace,
    name: string,
    type: SpanType
  ): Span

  /**
   * 记录 LLM 调用
   * @param span - 父 Span
   * @param generation - 生成数据
   */
  logGeneration(
    span: Span,
    generation: GenerationData
  ): void

  /**
   * 记录评分
   * @param traceId - 追踪 ID
   * @param score - 评分数据
   */
  score(
    traceId: string,
    score: ScoreData
  ): Promise<void>
}
```

### Agent 状态定义

```typescript
/**
 * Agent 基础状态
 * 所有 Agent 共享的状态结构
 */
interface AgentState {
  /** 消息历史 */
  messages: AIMessage[]
  /** 当前任务 */
  currentTask: string | null
  /** 执行计划 */
  plan: TaskPlan | null
  /** 工具调用结果 */
  toolResults: ToolCallResult[]
  /** 是否需要人工审批 */
  needsApproval: boolean
  /** 审批请求详情 */
  approvalRequest: ApprovalRequest | null
  /** 错误信息 */
  error: string | null
  /** 执行状态 */
  status: 'running' | 'waiting_approval' | 'completed' | 'failed'
}

/**
 * DevOps Agent 状态
 */
interface DevOpsAgentState extends AgentState {
  /** 部署目标 */
  deploymentTarget: DeploymentTarget | null
  /** 部署计划 */
  deploymentPlan: DeploymentStep[] | null
  /** 当前步骤索引 */
  currentStepIndex: number
  /** 回滚点 */
  rollbackPoint: RollbackPoint | null
}

/**
 * SRE Agent 状态
 */
interface SREAgentState extends AgentState {
  /** 告警信息 */
  alert: AlertInfo | null
  /** 诊断结果 */
  diagnosis: DiagnosisResult | null
  /** 修复建议 */
  remediation: RemediationPlan | null
  /** 事件时间线 */
  timeline: TimelineEvent[]
}
```

### MCP 工具定义

```typescript
/**
 * MCP 工具定义
 */
interface MCPTool {
  /** 工具名称 */
  name: string
  /** 工具描述 */
  description: string
  /** 参数 JSON Schema */
  inputSchema: JSONSchema
  /** 执行器 */
  handler: (args: Record<string, unknown>, context: ToolCallContext) => Promise<unknown>
  /** 权限要求 */
  permissions?: string[]
  /** 超时时间 (毫秒) */
  timeout?: number
  /** 是否需要审批 */
  requiresApproval?: boolean
}

/**
 * K8s 工具示例
 */
const k8sTools: MCPTool[] = [
  {
    name: 'k8s_get_pods',
    description: '获取指定命名空间的 Pod 列表',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string', description: '命名空间' },
        labelSelector: { type: 'string', description: '标签选择器' }
      },
      required: ['namespace']
    },
    handler: async (args, ctx) => {
      // 调用 K8sClientService
    },
    permissions: ['k8s:pods:read']
  },
  {
    name: 'k8s_scale_deployment',
    description: '扩缩容 Deployment',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string' },
        name: { type: 'string' },
        replicas: { type: 'number', minimum: 0 }
      },
      required: ['namespace', 'name', 'replicas']
    },
    handler: async (args, ctx) => {
      // 调用 K8sClientService
    },
    permissions: ['k8s:deployments:write'],
    requiresApproval: true  // 高风险操作需要审批
  }
]
```

## 数据模型

### Agent 执行记录

```typescript
/**
 * Agent 执行记录 (数据库表)
 */
interface AgentExecution {
  id: string
  userId: string
  projectId: string | null
  agentType: 'devops' | 'sre' | 'orchestrator'
  input: string
  status: 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled'
  result: Record<string, unknown> | null
  error: string | null
  checkpointId: string | null
  traceId: string | null
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// Drizzle Schema
export const agentExecutions = pgTable('agent_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  projectId: uuid('project_id').references(() => projects.id),
  agentType: varchar('agent_type', { length: 50 }).notNull(),
  input: text('input').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('running'),
  result: jsonb('result'),
  error: text('error'),
  checkpointId: uuid('checkpoint_id'),
  traceId: varchar('trace_id', { length: 100 }),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

### 检查点存储

```typescript
/**
 * 检查点记录 (数据库表)
 */
interface AgentCheckpoint {
  id: string
  executionId: string
  state: Record<string, unknown>  // 序列化的 AgentState
  nodeId: string  // 当前节点 ID
  createdAt: Date
}

// Drizzle Schema
export const agentCheckpoints = pgTable('agent_checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id').notNull().references(() => agentExecutions.id),
  state: jsonb('state').notNull(),
  nodeId: varchar('node_id', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

### 工具调用日志

```typescript
/**
 * 工具调用日志 (数据库表)
 */
interface ToolCallLog {
  id: string
  executionId: string
  toolName: string
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  error: string | null
  duration: number  // 毫秒
  approved: boolean | null  // 如果需要审批
  approvedBy: string | null
  createdAt: Date
}

// Drizzle Schema
export const toolCallLogs = pgTable('tool_call_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id').notNull().references(() => agentExecutions.id),
  toolName: varchar('tool_name', { length: 100 }).notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  error: text('error'),
  duration: integer('duration').notNull(),
  approved: boolean('approved'),
  approvedBy: uuid('approved_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

### 记忆存储

```typescript
/**
 * Agent 记忆 (Mem0 管理，这里定义接口)
 */
interface AgentMemory {
  id: string
  content: string
  type: 'fact' | 'preference' | 'decision' | 'context'
  scope: {
    userId: string
    projectId?: string
    organizationId?: string
  }
  metadata: {
    source: 'conversation' | 'tool_result' | 'manual'
    confidence: number
    extractedAt: Date
  }
  embedding: number[]  // 向量嵌入
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```



## 正确性属性

*正确性属性是系统在所有有效执行中都应该保持的特征。属性作为人类可读规格和机器可验证正确性保证之间的桥梁。*

### Property 1: 状态机状态传递不变性

*对于任意* LangGraph StateGraph 和初始状态，当执行通过多个节点时，状态对象应该在节点间完整传递，不丢失任何字段。

**验证方式**: 生成随机状态对象和节点序列，验证最终状态包含所有初始字段。

**Validates: Requirements 1.2**

### Property 2: 检查点序列化 Round-Trip

*对于任意* 有效的 AgentState 对象，序列化到检查点然后反序列化应该产生等价的状态对象。

```
serialize(state) → checkpoint → deserialize(checkpoint) ≡ state
```

**验证方式**: 生成随机 AgentState，执行 round-trip，验证深度相等。

**Validates: Requirements 1.6, 1.7**

### Property 3: 条件路由正确性

*对于任意* 状态和条件函数，Graph 的路由决策应该与条件函数的返回值完全一致。

**验证方式**: 生成随机状态和条件函数，验证路由结果匹配。

**Validates: Requirements 1.4**

### Property 4: 重试策略指数退避

*对于任意* 重试配置（baseDelay, maxRetries），第 n 次重试的延迟应该等于 `baseDelay * 2^n`。

**验证方式**: 生成随机配置，模拟失败，验证延迟计算。

**Validates: Requirements 1.3**

### Property 5: MCP 工具注册/发现一致性

*对于任意* 注册的 MCP 工具集合，`listTools()` 返回的工具列表应该包含所有已注册工具，且每个工具定义包含有效的 JSON Schema。

**验证方式**: 生成随机工具定义，注册后验证 listTools 结果。

**Validates: Requirements 2.1, 2.2**

### Property 6: MCP 参数验证正确性

*对于任意* MCP 工具和参数对象：
- 如果参数符合工具的 JSON Schema，调用应该成功执行
- 如果参数不符合 Schema，调用应该返回包含验证详情的结构化错误

**验证方式**: 生成随机工具和参数（有效/无效），验证行为一致性。

**Validates: Requirements 2.6, 2.7**

### Property 7: 工具执行超时

*对于任意* 超时配置和工具执行，如果执行时间超过配置的超时时间，应该抛出超时错误。

**验证方式**: 生成随机超时配置，模拟慢执行，验证超时行为。

**Validates: Requirements 2.8**

### Property 8: 工具调用审计完整性

*对于任意* 工具调用，调用完成后审计日志中应该包含该调用的完整记录（工具名、输入、输出/错误、耗时）。

**验证方式**: 执行随机工具调用，验证日志记录存在且完整。

**Validates: Requirements 2.9**

### Property 9: 记忆存储 Round-Trip

*对于任意* 有效的记忆内容和元数据，添加记忆后应该能通过 ID 检索到相同的内容。

```
add(content, metadata) → memoryId → get(memoryId).content ≡ content
```

**验证方式**: 生成随机记忆，执行 round-trip，验证内容相等。

**Validates: Requirements 5.1, 5.8**

### Property 10: 记忆范围隔离

*对于任意* 两个不同范围（userId/projectId/organizationId）的记忆，一个范围的查询不应该返回另一个范围的记忆。

**验证方式**: 生成不同范围的记忆，验证查询隔离。

**Validates: Requirements 5.3**

### Property 11: 记忆搜索相似度排序

*对于任意* 查询和记忆集合，搜索返回的结果应该按相似度分数降序排列。

**验证方式**: 生成随机记忆和查询，验证结果排序。

**Validates: Requirements 5.5**

### Property 12: 记忆过期清理

*对于任意* 设置了过期时间的记忆，当过期时间已过且执行清理后，该记忆应该无法被检索到。

**验证方式**: 生成带过期时间的记忆，模拟时间流逝，验证清理效果。

**Validates: Requirements 5.6**

### Property 13: 权限检查一致性

*对于任意* 用户、工具和 RBAC 策略配置，权限检查结果应该与策略定义一致：
- 如果用户有权限，工具调用应该执行
- 如果用户无权限，工具调用应该被拒绝并返回权限错误

**验证方式**: 生成随机用户、工具和策略，验证权限检查结果。

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 14: 追踪数据完整性

*对于任意* Agent 执行，追踪记录应该包含：
- 所有 LLM 调用（含 token 使用量和延迟）
- 所有工具调用（含输入/输出）
- 正确的父子关系

**验证方式**: 执行随机 Agent 任务，验证追踪数据完整性。

**Validates: Requirements 6.2, 6.3, 6.4**

### Property 15: 人工审批暂停

*对于任意* 标记为需要审批的操作，当执行到该操作时，Agent 状态应该变为 `waiting_approval`，且不继续执行后续步骤。

**验证方式**: 生成包含审批节点的 Graph，验证暂停行为。

**Validates: Requirements 1.5, 3.7**

### Property 16: 流式输出顺序性

*对于任意* Agent 执行，流式输出的事件应该按照执行顺序产生，且不丢失任何事件。

**验证方式**: 执行随机任务，收集流式事件，验证顺序和完整性。

**Validates: Requirements 1.8, 3.8, 10.2**

### Property 17: 现有服务集成不变性

*对于任意* Agent 执行，调用现有 AI 服务（AIService、RAGService 等）时，不应该修改这些服务的接口或行为。

**验证方式**: 验证服务调用签名和返回类型与原始定义一致。

**Validates: Requirements 7.1-7.7**

## 错误处理

### 错误分类

```typescript
/**
 * Agent 错误基类
 */
abstract class AgentError extends Error {
  abstract readonly code: string
  abstract readonly recoverable: boolean
}

/**
 * 工具执行错误
 */
class ToolExecutionError extends AgentError {
  code = 'TOOL_EXECUTION_ERROR'
  recoverable = true
  
  constructor(
    public toolName: string,
    public originalError: Error,
    public retryable: boolean
  ) {
    super(`Tool ${toolName} failed: ${originalError.message}`)
  }
}

/**
 * 权限错误
 */
class PermissionDeniedError extends AgentError {
  code = 'PERMISSION_DENIED'
  recoverable = false
  
  constructor(
    public userId: string,
    public requiredPermission: string
  ) {
    super(`User ${userId} lacks permission: ${requiredPermission}`)
  }
}

/**
 * 检查点错误
 */
class CheckpointError extends AgentError {
  code = 'CHECKPOINT_ERROR'
  recoverable = false
  
  constructor(
    public checkpointId: string,
    public reason: string
  ) {
    super(`Checkpoint ${checkpointId} error: ${reason}`)
  }
}

/**
 * 超时错误
 */
class TimeoutError extends AgentError {
  code = 'TIMEOUT'
  recoverable = true
  
  constructor(
    public operation: string,
    public timeoutMs: number
  ) {
    super(`Operation ${operation} timed out after ${timeoutMs}ms`)
  }
}

/**
 * 审批超时错误
 */
class ApprovalTimeoutError extends AgentError {
  code = 'APPROVAL_TIMEOUT'
  recoverable = false
  
  constructor(
    public executionId: string,
    public timeoutMs: number
  ) {
    super(`Approval for execution ${executionId} timed out`)
  }
}
```

### 错误恢复策略

| 错误类型 | 恢复策略 |
|---------|---------|
| ToolExecutionError (retryable) | 指数退避重试，最多 3 次 |
| ToolExecutionError (non-retryable) | 记录错误，尝试替代方案或终止 |
| PermissionDeniedError | 终止执行，返回权限错误给用户 |
| CheckpointError | 尝试从上一个有效检查点恢复 |
| TimeoutError | 重试或终止，取决于操作类型 |
| ApprovalTimeoutError | 终止执行，通知用户 |

## 测试策略

### 测试框架

- **单元测试**: Vitest
- **属性测试**: fast-check
- **集成测试**: Vitest + testcontainers
- **E2E 测试**: Playwright (前端)

### 测试分层

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         E2E Tests (少量)                                 │
│  • 完整用户流程                                                          │
│  • 前端到后端集成                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      Integration Tests (中等)                            │
│  • 服务间集成                                                            │
│  • 数据库交互                                                            │
│  • 外部服务 Mock                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                    Unit + Property Tests (大量)                          │
│  • 核心逻辑单元测试                                                      │
│  • 属性测试验证不变性                                                    │
│  • 边界条件测试                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 属性测试配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // 属性测试运行 100 次迭代
    fuzz: {
      numRuns: 100
    }
  }
})
```

### 测试示例

```typescript
// Property 2: 检查点 Round-Trip
import { fc } from '@fast-check/vitest'
import { describe, it, expect } from 'vitest'

describe('Checkpoint Round-Trip', () => {
  /**
   * Feature: ai-agent-platform, Property 2: 检查点序列化 Round-Trip
   * Validates: Requirements 1.6, 1.7
   */
  it.prop([agentStateArbitrary])('should preserve state through serialization', (state) => {
    const checkpoint = serializeCheckpoint(state)
    const restored = deserializeCheckpoint(checkpoint)
    
    expect(restored).toEqual(state)
  })
})

// Property 5: MCP 工具注册/发现一致性
describe('MCP Tool Registry', () => {
  /**
   * Feature: ai-agent-platform, Property 5: MCP 工具注册/发现一致性
   * Validates: Requirements 2.1, 2.2
   */
  it.prop([fc.array(mcpToolArbitrary, { minLength: 1, maxLength: 20 })])(
    'should list all registered tools',
    (tools) => {
      const server = new MCPServer()
      
      for (const tool of tools) {
        server.registerTool(tool)
      }
      
      const listed = server.listTools()
      
      // 所有注册的工具都应该在列表中
      for (const tool of tools) {
        expect(listed.some(t => t.name === tool.name)).toBe(true)
      }
      
      // 每个工具都应该有有效的 JSON Schema
      for (const tool of listed) {
        expect(tool.inputSchema).toBeDefined()
        expect(typeof tool.inputSchema).toBe('object')
      }
    }
  )
})

// Property 10: 记忆范围隔离
describe('Memory Scope Isolation', () => {
  /**
   * Feature: ai-agent-platform, Property 10: 记忆范围隔离
   * Validates: Requirements 5.3
   */
  it.prop([
    memoryScopeArbitrary,
    memoryScopeArbitrary,
    fc.string({ minLength: 1 })
  ])('should isolate memories by scope', async (scope1, scope2, content) => {
    // 跳过相同范围的情况
    fc.pre(scope1.userId !== scope2.userId || scope1.projectId !== scope2.projectId)
    
    const memory = await memoryService.add(content, { scope: scope1 })
    
    // 相同范围应该能找到
    const found1 = await memoryService.search(content, scope1)
    expect(found1.some(m => m.id === memory.id)).toBe(true)
    
    // 不同范围不应该找到
    const found2 = await memoryService.search(content, scope2)
    expect(found2.some(m => m.id === memory.id)).toBe(false)
  })
})
```

### 测试数据生成器

```typescript
import { fc } from '@fast-check/vitest'

// AgentState 生成器
const agentStateArbitrary = fc.record({
  messages: fc.array(aiMessageArbitrary),
  currentTask: fc.option(fc.string()),
  plan: fc.option(taskPlanArbitrary),
  toolResults: fc.array(toolResultArbitrary),
  needsApproval: fc.boolean(),
  approvalRequest: fc.option(approvalRequestArbitrary),
  error: fc.option(fc.string()),
  status: fc.constantFrom('running', 'waiting_approval', 'completed', 'failed')
})

// MCP Tool 生成器
const mcpToolArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z_]+$/.test(s)),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  inputSchema: jsonSchemaArbitrary,
  permissions: fc.array(fc.string()),
  timeout: fc.option(fc.integer({ min: 100, max: 60000 })),
  requiresApproval: fc.boolean()
})

// Memory Scope 生成器
const memoryScopeArbitrary = fc.record({
  userId: fc.uuid(),
  projectId: fc.option(fc.uuid()),
  organizationId: fc.option(fc.uuid())
})
```

### 单元测试覆盖要求

| 组件 | 覆盖率目标 |
|------|-----------|
| AgentService | 90% |
| GraphExecutor | 85% |
| MCPServer | 90% |
| MemoryService | 85% |
| TracingService | 80% |
| 工具实现 | 80% |

### 集成测试场景

1. **Agent 完整执行流程**
   - 用户输入 → 计划生成 → 工具调用 → 结果返回

2. **检查点恢复**
   - 执行中断 → 保存检查点 → 恢复执行 → 完成

3. **人工审批流程**
   - 高风险操作 → 暂停等待 → 审批通过 → 继续执行

4. **错误恢复**
   - 工具失败 → 重试 → 成功/最终失败

5. **多 Agent 协作**
   - 任务委派 → 并行执行 → 结果聚合

