# Requirements Document

## Introduction

本文档定义了 AI Agent 平台的需求规格，旨在将现有的 AI 能力（12 个独立服务）整合为一个统一的、具备自主决策能力的 AI Agent 系统。

### 2025 前沿技术栈

| 组件 | 技术选型 | 选型理由 |
|------|----------|----------|
| Agent 框架 | **LangGraph.js** | LangChain 团队出品，TypeScript 原生，状态机模式支持复杂工作流、条件分支、人工审批、检查点恢复 |
| 工具协议 | **MCP (Model Context Protocol)** | Anthropic 官方开源协议，Claude Desktop/Cursor/Windsurf 都在用，生态爆发中 |
| 记忆系统 | **Mem0** | 专门的 Agent 记忆层，支持语义搜索、自动提取、跨会话持久化 |
| 可观测性 | **Langfuse** | 开源可自托管，支持追踪、评估、成本分析，比 LangSmith 更适合私有部署 |
| LLM 调用 | **Vercel AI SDK 4.0** (已有) | 继续使用，统一的多模型接口 |

### 与现有架构的关系

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent Layer (新增)                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ LangGraph   │ │    MCP      │ │   Mem0      │            │
│  │ (状态机)    │ │ (工具协议)  │ │ (记忆)      │            │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘            │
│         │               │               │                    │
│         └───────────────┼───────────────┘                    │
│                         ▼                                    │
├─────────────────────────────────────────────────────────────┤
│                 Existing AI Services (复用)                  │
│  AIService │ RAGService │ FunctionCalling │ ContentFilter   │
│  UsageTracking │ AICacheService │ ConversationService       │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**: 组合 + 扩展，不重构现有服务

## 架构师评估：2026 年最前沿技术选型

### 2026 年 AI Agent 框架全景图

| 框架 | 发布方 | 特点 | 适用场景 | 前沿程度 |
|------|--------|------|----------|----------|
| **LangGraph** | LangChain | 状态机、检查点、人工审批 | 复杂工作流、多模型 | ⭐⭐⭐⭐⭐ |
| **OpenAI Agents SDK** | OpenAI | Handoff 模式、内置工具 | OpenAI 生态、快速上线 | ⭐⭐⭐⭐⭐ |
| **Google ADK** | Google | 双向音视频流、Gemini 集成 | GCP 生态、多模态 | ⭐⭐⭐⭐⭐ |
| **Agno** | Phidata | 极致性能（比 LangGraph 快 10000x）| 高性能、多 Agent | ⭐⭐⭐⭐⭐ |
| **CrewAI** | 开源 | 角色扮演、团队协作 | SOP 工作流 | ⭐⭐⭐⭐ |
| **AutoGen** | Microsoft | 事件驱动、Studio UI | 研究原型 | ⭐⭐⭐⭐ |
| **PydanticAI** | Pydantic | 类型安全、结构化输出 | 参数校验严格场景 | ⭐⭐⭐⭐ |

### 我的最终推荐（2026 年 1 月）

| 组件 | 推荐选型 | 备选方案 | 选型理由 |
|------|----------|----------|----------|
| **Agent 框架** | **LangGraph.js** | Agno (如果需要极致性能) | 最成熟、社区最大、TypeScript 原生、状态机模式是最佳实践 |
| **工具协议** | **MCP** | OpenAI Agents SDK (如果只用 OpenAI) | Anthropic 标准协议，Claude/Cursor/Windsurf 都在用，生态爆发中 |
| **记忆系统** | **Mem0** | Redis + Qdrant 自建 | 专门的 Agent 记忆层，比自己写专业 |
| **可观测性** | **Langfuse** | LangSmith (如果不介意 SaaS) | 开源可自托管，功能完整 |

### 为什么不选其他新框架？

| 框架 | 不选的理由 |
|------|------------|
| **OpenAI Agents SDK** | 锁定 OpenAI 模型，我们需要多模型支持（Claude、Qwen、Ollama） |
| **Google ADK** | Python 优先，TypeScript 支持弱；锁定 GCP/Gemini |
| **Agno** | 太新（2024 年底），生态还不成熟；Python 优先 |
| **CrewAI** | Python 优先，TypeScript 支持弱 |

### 关键洞察

1. **LangGraph 仍然是 2026 年的最佳选择**
   - LangChain 官方推荐："新 Agent 应该用 LangGraph 构建"
   - 最大的社区和生态（600+ 集成）
   - TypeScript 原生支持

2. **MCP 正在成为行业标准**
   - Anthropic 2024.11 开源
   - Claude Desktop、Cursor、Windsurf、Zed 都在用
   - 工具发现和调用的标准化协议

### 关于 Agno 的深度分析

**Agno 的性能数据确实惊人：**

| 指标 | Agno | LangGraph | 差距 |
|------|------|-----------|------|
| 实例化时间 | 3μs | 1,587μs | **529 倍** |
| 内存占用 | 6.6 KiB | 161 KiB | **24 倍** |

**但是，我不推荐现在用 Agno 的原因：**

1. **Python 优先，没有 TypeScript SDK**
   - Agno 是纯 Python 框架
   - 我们的后端是 NestJS (TypeScript)
   - 如果用 Agno，需要单独部署一个 Python 服务，增加运维复杂度

2. **架构不匹配**
   - Agno 自带 FastAPI 运行时 (AgentOS)
   - 我们已经有 NestJS + tRPC 架构
   - 引入 Agno 意味着两套 API 服务

3. **生态还在早期**
   - 2024 年底才从 Phidata 改名
   - 社区和文档还在完善中
   - LangGraph 有 600+ 集成，Agno 还在追赶

**什么时候应该考虑 Agno？**

- 如果你是 Python 技术栈 → **强烈推荐 Agno**
- 如果需要极致性能（每秒处理数千个 Agent 实例）→ **考虑 Agno**
- 如果是新项目，没有现有架构包袱 → **可以考虑 Agno**

**我们的情况：**

- TypeScript/NestJS 技术栈 → **LangGraph.js 更合适**
- 已有 12 个 AI 服务需要集成 → **LangGraph 生态更成熟**
- 需要与现有 tRPC API 集成 → **LangGraph.js 无缝集成**

**结论：Agno 性能确实惊人，但对我们的 TypeScript 技术栈来说，LangGraph.js 是更实际的选择。**

**未来可能的演进路径：**
- Phase 1-4: 用 LangGraph.js 构建核心 Agent 系统
- Phase 5+: 如果 Agno 推出 TypeScript SDK，或者我们需要极致性能，可以考虑迁移

### 潜在风险和缓解措施

| 风险 | 缓解措施 |
|------|----------|
| MCP 生态还在早期 | Anthropic 在大力推，风险可控；我们的 FunctionCallingService 可以作为兜底 |
| Mem0 相对年轻 | 可以先用 Redis + Qdrant 自己实现，后续迁移 |
| LangGraph 学习曲线 | 状态机概念需要时间，但一旦掌握非常强大 |

**结论：我们的技术选型（LangGraph + MCP + Mem0 + Langfuse）是 2026 年 1 月最前沿、最实用的组合。**

---

## 术语表

- **Agent**: 具备自主决策能力的 AI 实体，能够理解目标、规划任务、执行操作并从结果中学习
- **LangGraph**: LangChain 团队开发的状态机驱动 Agent 框架，支持复杂的多步骤工作流
- **MCP (Model Context Protocol)**: Anthropic 发布的开放协议，标准化 AI 与外部工具/资源的交互方式
- **Mem0**: AI Agent 长期记忆系统，支持跨会话的上下文保持和学习
- **Langfuse**: AI 应用可观测性平台，提供追踪、评估和监控能力
- **DevOps_Agent**: 专注于 DevOps 任务的 AI Agent，包括部署、监控、故障排查
- **SRE_Agent**: 专注于站点可靠性工程的 AI Agent，包括告警响应、容量规划
- **Tool**: Agent 可调用的外部能力，如 K8s 操作、Git 操作、监控查询
- **Graph**: LangGraph 中的工作流定义，由节点（Node）和边（Edge）组成
- **Node**: Graph 中的执行单元，代表一个具体的操作或决策点
- **State**: Agent 执行过程中的状态数据，在 Graph 节点间传递

## 需求列表

### 需求 1: LangGraph Agent 核心框架

**用户故事:** 作为平台开发者，我希望使用 LangGraph.js 构建 AI Agent，以便创建有状态的、多步骤的工作流，支持错误处理和人工审批。

#### 验收标准

1. Agent 框架应提供基础 Graph 构建器，创建带类型状态的 LangGraph StateGraph 实例
2. 当 Agent 执行 Graph 时，框架应在所有节点间维护状态
3. 当节点执行失败时，框架应支持可配置的重试策略（指数退避）
4. 框架应支持条件边，根据状态值路由执行
5. 当需要人工审批时，框架应暂停执行并发出审批请求事件
6. 框架应支持检查点，为长时间运行的工作流持久化 Graph 状态
7. 当从检查点恢复时，框架应恢复精确状态并继续执行
8. 框架应提供流式接口，用于实时执行更新

### 需求 2: MCP (Model Context Protocol) 集成

**用户故事:** 作为平台开发者，我希望通过 MCP 暴露平台能力，以便 AI Agent 能以标准化方式发现和使用工具。

#### 验收标准

1. MCP 服务器应实现 MCP 协议规范，支持工具发现和调用
2. 当 Agent 请求可用工具时，MCP 服务器应返回带 JSON Schema 参数的工具定义列表
3. MCP 服务器应将 K8s 操作暴露为 MCP 工具（获取 Pod、扩缩容、查看日志等）
4. MCP 服务器应将 Git 操作暴露为 MCP 工具（创建分支、提交、创建 PR 等）
5. MCP 服务器应将监控操作暴露为 MCP 工具（查询指标、获取告警等）
6. 当工具被调用时，MCP 服务器应根据工具的 JSON Schema 验证参数
7. 如果参数验证失败，MCP 服务器应返回带验证详情的结构化错误
8. MCP 服务器应支持工具执行超时，超时时间可配置
9. MCP 服务器应记录所有工具调用，用于审计和调试

### 需求 3: DevOps Agent 实现

**用户故事:** 作为 DevOps 工程师，我希望有一个 AI Agent 能自主处理部署任务，以便我能专注于更高层次的架构决策。

#### 验收标准

1. DevOps Agent 应理解自然语言部署请求，并转换为可执行计划
2. 当收到部署请求时，DevOps Agent 应生成分步执行计划
3. DevOps Agent 应使用 MCP 工具执行部署计划（K8s、Git、CI/CD）
4. 当部署步骤失败时，DevOps Agent 应分析错误并建议修复方案
5. DevOps Agent 应支持部署失败时的回滚操作
6. DevOps Agent 应集成现有 RAG 服务，检索项目特定上下文
7. 当执行高风险操作时，DevOps Agent 应在继续前要求人工审批
8. DevOps Agent 应在部署执行期间提供实时进度更新

### 需求 4: SRE Agent 实现

**用户故事:** 作为 SRE，我希望有一个 AI Agent 能响应告警并执行初步分诊，以便减少平均修复时间。

#### 验收标准

1. SRE Agent 应接收并处理来自监控系统的告警
2. 当收到告警时，SRE Agent 应分析告警上下文和严重程度
3. SRE Agent 应查询相关指标和日志来诊断问题
4. SRE Agent 应生成带根因分析的诊断报告
5. SRE Agent 应基于历史模式建议修复操作
6. 当启用自动修复时，SRE Agent 应自动执行安全的修复操作
7. SRE Agent 应在置信度低或风险高时升级给人工运维
8. SRE Agent 应维护包含所有操作的事件时间线

### 需求 5: Mem0 长期记忆系统

**用户故事:** 作为平台用户，我希望 AI Agent 能记住之前交互的上下文，以便我不必重复信息，Agent 能从过去经验中学习。

#### 验收标准

1. 记忆系统应使用 Mem0 存储对话历史和提取的事实
2. 当新对话开始时，记忆系统应检索相关记忆作为上下文
3. 记忆系统应支持按用户、项目和组织划分记忆范围
4. 记忆系统应自动从对话中提取并存储重要事实
5. 记忆系统应支持按语义相似度搜索记忆
6. 记忆系统应支持记忆过期和清理策略
7. 当 Agent 做出决策时，记忆系统应存储决策上下文供未来学习
8. 记忆系统应提供 API 手动添加、更新或删除记忆

### 需求 6: Langfuse 可观测性集成

**用户故事:** 作为平台运维，我希望追踪和监控 AI Agent 执行，以便调试问题和优化性能。

#### 验收标准

1. 可观测性系统应使用 Langfuse 追踪所有 Agent 执行
2. 当 Agent 执行时，可观测性系统应创建包含所有 LLM 调用和工具调用的追踪
3. 可观测性系统应捕获每次 LLM 调用的 Token 使用量和延迟
4. 可观测性系统应捕获每次工具调用的输入/输出
5. 可观测性系统应支持自定义 Span 用于业务逻辑追踪
6. 可观测性系统应与现有 Pino 日志集成，支持关联
7. 可观测性系统应提供按用户、项目和 Agent 类型的成本追踪
8. 可观测性系统应支持 Agent 响应的评估打分

### 需求 7: 与现有 AI 服务集成

**用户故事:** 作为平台开发者，我希望新 Agent 系统能利用现有 AI 服务，以便不重复功能并保持一致性。

#### 验收标准

1. Agent 系统应使用现有 AIService 进行 LLM 调用
2. Agent 系统应使用现有 RAGService 进行上下文检索
3. Agent 系统应使用现有 FunctionCallingService 作为 MCP 工具的桥接
4. Agent 系统应使用现有 ContentFilterService 进行输入/输出安全过滤
5. Agent 系统应使用现有 UsageTrackingService 进行配额管理
6. Agent 系统应在适当时使用现有 AICacheService 进行响应缓存
7. 当与现有服务集成时，Agent 系统不应修改它们的接口

### 需求 8: 安全与权限控制

**用户故事:** 作为安全工程师，我希望 AI Agent 遵守访问控制，以便用户只能执行被授权的操作。

#### 验收标准

1. Agent 系统应在执行任何工具前验证用户权限
2. 当工具需要提升权限时，Agent 系统应检查 RBAC 策略
3. Agent 系统应支持工具级别的权限配置
4. Agent 系统应记录所有权限检查用于审计
5. 如果用户缺少请求操作的权限，Agent 系统应解释限制原因
6. Agent 系统应支持按用户和按工具的速率限制
7. Agent 系统应清理所有输入以防止提示注入攻击

### 需求 9: 多 Agent 协作（第 5 阶段）

**用户故事:** 作为平台架构师，我希望多个专业 Agent 能协作处理复杂任务，以便处理需要不同专业知识的复杂工作流。

#### 验收标准

1. 多 Agent 系统应支持定义具有专业角色的 Agent 团队
2. 多 Agent 系统应支持通过消息总线进行 Agent 间通信
3. 当任务需要多个专业领域时，编排 Agent 应将子任务委派给专业 Agent
4. 多 Agent 系统应支持独立子任务的并行执行
5. 多 Agent 系统应将多个 Agent 的结果聚合为连贯的响应
6. 多 Agent 系统应处理 Agent 提供矛盾建议时的冲突
7. 多 Agent 系统应维护所有 Agent 可访问的共享上下文

### 需求 10: API 与用户界面

**用户故事:** 作为前端开发者，我希望有一个清晰的 API 与 AI Agent 交互，以便构建直观的用户界面。

#### 验收标准

1. Agent API 应暴露 tRPC 端点用于 Agent 交互
2. Agent API 应支持流式响应用于实时更新
3. Agent API 应返回带操作计划和执行状态的结构化响应
4. Agent API 应支持多轮交互的对话线程
5. 当 Agent 需要人工输入时，Agent API 应返回带选项的结构化提示
6. Agent API 应支持取消进行中的 Agent 执行
7. Agent API 应提供带完整追踪详情的执行历史

---

## 实施阶段规划

### Phase 1: 基础 Agent + 平台工具 (MVP)
- LangGraph 核心框架
- MCP Server 实现
- 基础 DevOps Agent
- 与现有 AIService 集成

### Phase 2: 任务规划 + 自主执行
- 复杂任务分解
- 多步骤执行
- 错误恢复和重试
- Human-in-the-loop

### Phase 3: 记忆系统 + 自学习
- Mem0 集成
- 跨会话上下文
- 决策历史学习
- 个性化响应

### Phase 4: 预测性运维
- SRE Agent 完整实现
- 告警智能响应
- 根因分析
- 自动修复

### Phase 5: 多 Agent 协作
- Agent 团队定义
- 任务委派
- 结果聚合
- 冲突解决

---

## 目录结构预览

```
packages/services/extensions/src/ai/
├── agent/
│   ├── graphs/                    # LangGraph 工作流
│   │   ├── devops-agent.graph.ts  # DevOps Agent 状态机
│   │   ├── sre-agent.graph.ts     # SRE Agent 状态机
│   │   └── nodes/                 # 图节点
│   │       ├── reasoning.node.ts
│   │       ├── tool-call.node.ts
│   │       └── human-review.node.ts
│   │
│   ├── mcp/                       # MCP 协议实现
│   │   ├── mcp-server.ts          # MCP Server
│   │   ├── tools/                 # MCP Tools
│   │   │   ├── k8s.tool.ts
│   │   │   ├── deployment.tool.ts
│   │   │   └── gitops.tool.ts
│   │   └── resources/             # MCP Resources
│   │       ├── project.resource.ts
│   │       └── logs.resource.ts
│   │
│   ├── memory/                    # Mem0 集成
│   │   ├── memory.service.ts
│   │   └── memory.types.ts
│   │
│   └── observability/             # Langfuse 集成
│       └── tracing.service.ts
│
├── ai/                            # 现有服务 (保持不变)
├── rag/                           # 现有服务 (保持不变)
├── functions/                     # 现有服务 (保持不变)
└── ...
```

---

## 新增依赖

```json
{
  "dependencies": {
    "@langchain/langgraph": "^0.2.x",
    "@modelcontextprotocol/sdk": "^1.x",
    "mem0ai": "^0.1.x",
    "langfuse": "^3.x"
  }
}
```
