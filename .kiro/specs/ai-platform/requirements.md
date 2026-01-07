# AI Platform 需求文档 - AI Native 架构

## 简介

AI Platform 是为多租户 DevOps 平台设计的 **AI Native** 智能层，不是传统的"套壳 Chatbot"。核心理念：**AI 不只是回答问题，而是生成可交互的界面、执行确定性验证、持续自我评估和优化**。

### 核心技术栈 (分阶段演进)

#### Phase 1: MVP 核心栈 (Gemini-First, No-Ops)

| 组件 | 技术选型 | 版本 | 核心能力 | 触发升级条件 |
|------|----------|------|----------|------------|
| **AI SDK** | Vercel AI SDK (Vue) | 6.0.14 | **Tool-Driven Dynamic UI** + Stream | - |
| **前端框架** | Vue 3 + Pinia | 3.5+ | 动态组件 + 响应式状态 | - |
| **Primary Provider** | **Google Gemini** | 1.5 | Flash (路由/UI) + Pro (推理) | - |
| **知识引擎** | **Context Caching** | - | 超长上下文 (2M Token) | 项目 > 2M Token 时升级 |
| **多模态** | **Gemini Vision** | - | 图片/视频分析 | - |
| **Safety** | Gemini Safety + Lakera Guard | - | 双层防火墙 | - |
| **UI 组件库** | Shadcn-vue / Naive UI | - | 高质量交互组件 | - |

#### Phase 2: 规模化扩展 (触发条件：月 API 费用 > $5000 或客户要求私有化)

| 组件 | 技术选型 | 触发条件 | 核心能力 |
|------|----------|----------|----------|
| **Fallback Provider** | OpenAI/Anthropic | Google API 故障率 > 1% | 容灾备份 |
| **本地模型** | Ollama (Llama3 8B) | 私有化部署需求 | 意图识别 + 成本优化 |
| **高级 RAG** | GraphRAG + Qdrant | 项目 > 2M Token | 超大项目知识图谱 |
| **Evals** | Braintrust/LangSmith | 用户 > 100 | LLM-as-Judge + Dataset |

### 架构原则 (演进式)

#### Phase 1 原则 (极简主义)
1. **Tool-Driven Dynamic UI**: AI 通过工具调用生成结构化数据，前端动态渲染 Vue 组件
2. **Deterministic Validation**: 所有 AI 生成的代码必须经过确定性验证
3. **Context Over Retrieval**: 优先使用超长上下文，避免碎片化检索
4. **Multimodal First**: 原生支持图片/视频输入
5. **Serverless Ops**: 完全依赖云端 API，零运维负担
6. **Safety by Design**: 输入/输出实时防火墙

#### Phase 2 原则 (企业级增强)
7. **Hybrid Knowledge Engine**: 根据项目规模自动选择 Context Caching 或 GraphRAG
8. **Multi-Provider Resilience**: 多 Provider 容灾和成本优化
9. **Human-in-the-Loop 2.0**: Plan → Approve → Execute 三段式
10. **Continuous Evaluation**: 每个 Agent 响应都有质量评分

## 术语表

### Phase 1 核心术语
- **Tool_Driven_Dynamic_UI**: AI 通过工具调用返回结构化数据，前端根据工具名动态渲染 Vue 组件
- **Component_Registry**: 前端维护的组件映射表，将工具名映射到 Vue 组件
- **Context_Caching**: Gemini 的超长上下文缓存机制，支持 2M Token 的项目级知识存储
- **Multimodal_Input**: 支持文本、图片、视频等多种输入形式
- **Deterministic_Validation**: 对 AI 生成内容进行确定性验证（kubeval, conftest, shellcheck）

### Phase 2 扩展术语
- **Hybrid_Search**: 向量检索 + 关键词检索 (BM25) 的混合模式
- **Rerank**: 检索后的重排序模型，提升准确率
- **GraphRAG**: 基于知识图谱的检索增强（用于超大项目）
- **LLM_as_Judge**: 用高智商模型评估其他模型的输出质量
- **Cascade_Inference**: 先用小模型尝试，置信度低再调大模型
- **HITL**: Human-in-the-Loop，人工审批流程
- **Evals**: 评估系统，测试 AI 质量

## 需求

### 需求 1: Tool-Driven Dynamic UI - AI 驱动的动态界面

**用户故事:** 作为用户，我希望 AI 不只返回文本，而是通过工具调用生成可交互的界面组件，以便直接操作而不是读文字。

#### 验收标准

1. THE AI_Platform SHALL 使用 Vercel AI SDK (@ai-sdk/vue) 的 streamText + tools 生成结构化数据
2. WHEN DevOps Agent 检测到 Pod 故障时, THE AI_Platform SHALL 调用 showClusterDashboard 工具返回 JSON 数据 (status, logs, cpuUsage)
3. WHEN SRE Agent 分析告警时, THE AI_Platform SHALL 调用 showDiagnosticTree 工具返回诊断树结构
4. THE AI_Platform SHALL 在前端维护 Component Registry 映射工具名到 Vue 组件
5. THE AI_Platform SHALL 使用 Vue 的 `<component :is="...">` 动态渲染组件
6. THE AI_Platform SHALL 支持组件的懒加载 (defineAsyncComponent)
7. THE AI_Platform SHALL 在工具定义中使用 Zod 定义参数 schema
8. THE AI_Platform SHALL 支持流式更新工具调用状态 (pending → result)

### 需求 2: Hybrid Knowledge Engine - 智能知识路由 (分阶段)

**用户故事:** 作为平台用户，我希望 AI 能理解我的整个项目，而不是只看到搜索出来的几段话。

#### Phase 1 验收标准 (Context Caching 优先)

1. THE Knowledge_Engine SHALL 使用 **Gemini Context Caching** 作为主要知识存储方案
2. THE Knowledge_Engine SHALL 支持将租户的代码库、文档一次性缓存到 Gemini (最大 2M Token)
3. WHEN 代码库有 Git Push 事件时, THE Knowledge_Engine SHALL 自动刷新 Cache
4. THE Knowledge_Engine SHALL 管理 Cache 的 TTL (Time-To-Live) 和续期策略
5. THE Knowledge_Engine SHALL 对不活跃租户允许 Cache 过期以节省成本
6. THE Knowledge_Engine SHALL 记录每次 Cache 操作的成本和命中率
7. THE Knowledge_Engine SHALL 在 Cache 失败时返回明确的错误信息
8. THE Knowledge_Engine SHALL 支持 Cache 的增量更新（仅更新变更文件）

#### Phase 2 验收标准 (触发条件：项目 > 2M Token 或 Cache 召回率 < 80%)

9. THE Knowledge_Engine SHALL 实现 Hybrid Search (向量检索 + BM25 关键词检索)
10. THE Knowledge_Engine SHALL 使用 Rerank 模型 (Cohere/BGE) 对检索结果重排序
11. THE Knowledge_Engine SHALL 构建 DevOps 知识图谱 (Pod → Service → Namespace → Cluster)
12. WHEN 查询涉及实体关系时, THE Knowledge_Engine SHALL 使用 GraphRAG 检索
13. THE Knowledge_Engine SHALL 支持多跳推理 (multi-hop reasoning)
14. THE Knowledge_Engine SHALL 在响应中标注每个事实的来源和置信度
15. THE Knowledge_Engine SHALL 支持文档的分块策略 (semantic chunking)
16. THE Knowledge_Engine SHALL 支持查询改写 (query rewriting) 提升召回率

### 需求 3: Deterministic Validation - 确定性验证

**用户故事:** 作为平台管理员，我希望 AI 生成的代码必须经过验证，以便避免生产事故。

#### 验收标准

1. THE AI_Platform SHALL 对所有 AI 生成的 K8s YAML 运行 kubeval 验证
2. THE AI_Platform SHALL 对所有 AI 生成的配置运行 conftest 策略检查
3. THE AI_Platform SHALL 对所有 AI 生成的脚本运行 shellcheck 静态分析
4. WHEN 验证失败时, THE AI_Platform SHALL 将错误反馈给 AI 重新生成
5. THE AI_Platform SHALL 支持自定义验证规则 (OPA Rego)
6. THE AI_Platform SHALL 在沙箱环境 (Firecracker/gVisor) 中执行代码
7. THE AI_Platform SHALL 限制代码执行的资源 (CPU/内存/网络)
8. THE AI_Platform SHALL 记录所有验证失败的案例用于模型改进

### 需求 4: Human-in-the-Loop 2.0 - 智能审批流

**用户故事:** 作为 DevOps 工程师，我希望 AI 只生成计划而不直接执行，以便我审批后再执行。

#### 验收标准

1. THE AI_Platform SHALL 将高风险操作分为三阶段: Plan → Approve → Execute
2. WHEN Agent 生成部署计划时, THE AI_Platform SHALL 渲染 Diff 预览组件
3. THE AI_Platform SHALL 支持计划的版本对比 (before/after)
4. THE AI_Platform SHALL 计算操作的风险评分 (基于影响范围)
5. WHEN 风险评分高时, THE AI_Platform SHALL 要求多人审批
6. THE AI_Platform SHALL 支持审批的超时和自动拒绝
7. THE AI_Platform SHALL 记录审批历史和决策理由
8. THE AI_Platform SHALL 支持审批后的回滚预案生成

### 需求 5: Evaluation Pipeline - 持续质量监控

**用户故事:** 作为 AI 工程师，我希望持续评估 Agent 的质量，以便优化 Prompt 和模型选择。

#### 验收标准

1. THE AI_Platform SHALL 使用 LLM-as-Judge 评估每个 Agent 响应的质量
2. THE AI_Platform SHALL 定义评估维度 (准确性、完整性、安全性、可执行性)
3. THE AI_Platform SHALL 收集用户的点赞/点踩数据构建 Golden Dataset
4. WHEN Prompt 修改时, THE AI_Platform SHALL 在 Golden Dataset 上运行回归测试
5. THE AI_Platform SHALL 对比不同模型 (GPT-4o vs Claude 3.5) 的表现
6. THE AI_Platform SHALL 计算幻觉率 (hallucination rate)
7. THE AI_Platform SHALL 暴露评估报表 API (按时间、Agent 类型、模型)
8. THE AI_Platform SHALL 支持 A/B 测试不同的 Prompt 版本

### 需求 6: Intelligent Model Router - 智能模型路由 (分阶段)

**用户故事:** 作为平台运营，我希望简单任务用快速模型，复杂任务用强大模型，以便降低成本。

#### Phase 1 验收标准 (Gemini-First)

1. THE AI_Platform SHALL 使用 **Gemini 1.5 Flash** 处理快速路径 (UI 生成、简单查询、意图识别)
2. THE AI_Platform SHALL 使用 **Gemini 1.5 Pro** 处理深度路径 (代码重构、根因分析、全库审计)
3. THE AI_Platform SHALL 根据任务复杂度自动路由到 Flash 或 Pro
4. THE AI_Platform SHALL 记录每个路由决策和成本
5. THE AI_Platform SHALL 支持基于延迟的动态路由 (TTFT < 300ms 用 Flash)
6. THE AI_Platform SHALL 计算每个路由策略的成本效益比
7. THE AI_Platform SHALL 支持租户级别的模型偏好设置

#### Phase 2 验收标准 (触发条件：月 API 费用 > $5000 或私有化需求)

8. THE AI_Platform SHALL 支持 OpenAI/Anthropic 作为 Fallback Provider
9. THE AI_Platform SHALL 在 Gemini API 故障时自动切换到备用 Provider
10. THE AI_Platform SHALL 部署 Ollama (Llama3 8B) 用于本地意图识别
11. THE AI_Platform SHALL 支持 Cascade Inference (本地模型先尝试，置信度低再调云端)
12. THE AI_Platform SHALL 对比不同 Provider 的实际成本和质量
13. THE AI_Platform SHALL 支持模型的 A/B 测试和灰度发布

### 需求 7: Safety Guardrails - 实时安全防火墙

**用户故事:** 作为安全工程师，我希望 AI 的输入和输出都经过安全检查，以便防止提示注入和敏感信息泄露。

#### 验收标准

1. THE AI_Platform SHALL 集成 Lakera Guard 或类似服务进行实时安全检查
2. THE AI_Platform SHALL 检测输入中的提示注入攻击 (prompt injection)
3. THE AI_Platform SHALL 检测输出中的敏感信息 (API key, password, PII)
4. THE AI_Platform SHALL 检测输出中的有害内容 (恶意代码、钓鱼链接)
5. WHEN 检测到风险时, THE AI_Platform SHALL 阻止请求并记录事件
6. THE AI_Platform SHALL 支持自定义安全规则 (正则、关键词、ML 模型)
7. THE AI_Platform SHALL 对敏感信息进行脱敏处理 (masking)
8. THE AI_Platform SHALL 暴露安全事件 API 用于 SIEM 集成

### 需求 8: MCP Bidirectional - 双向工具协议

**用户故事:** 作为开发者，我希望我的 Cursor IDE 能直接连接平台的 MCP Server，以便在本地访问平台资源。

#### 验收标准

1. THE AI_Platform SHALL 作为 MCP Server 暴露平台能力 (文档、日志、指标)
2. THE AI_Platform SHALL 作为 MCP Client 连接外部 MCP Server (GitHub, Jira)
3. THE AI_Platform SHALL 支持 MCP Resources (只读数据源)
4. THE AI_Platform SHALL 支持 MCP Prompts (预定义提示词模板)
5. THE AI_Platform SHALL 支持 MCP Sampling (模型调用代理)
6. WHEN 用户的 Cursor 连接时, THE AI_Platform SHALL 验证身份和权限
7. THE AI_Platform SHALL 支持 MCP 的流式响应和长连接
8. THE AI_Platform SHALL 记录所有 MCP 连接和调用用于审计

### 需求 9: Feedback Loop & Fine-tuning - 持续学习

**用户故事:** 作为 AI 工程师，我希望利用用户反馈数据微调模型，以便在垂直领域超越通用模型。

#### 验收标准

1. THE AI_Platform SHALL 收集所有用户反馈 (点赞/点踩/修改)
2. THE AI_Platform SHALL 将反馈数据转换为训练样本 (input/output/score)
3. THE AI_Platform SHALL 支持对 Llama3 8B 进行 LoRA 微调
4. THE AI_Platform SHALL 在 DevOps 日志分析任务上微调专用模型
5. THE AI_Platform SHALL 对比微调前后的性能提升
6. THE AI_Platform SHALL 支持微调模型的 A/B 测试
7. THE AI_Platform SHALL 支持微调模型的版本管理和回滚
8. THE AI_Platform SHALL 定期重新训练模型以适应新数据

### 需求 10: DevOps Agent - 智能部署助手

**用户故事:** 作为 DevOps 工程师，我希望 Agent 能生成部署计划并预览变更，以便我审批后执行。

#### 验收标准

1. THE DevOps_Agent SHALL 理解自然语言部署需求并生成结构化计划
2. THE DevOps_Agent SHALL 调用 showDeploymentDiff 工具返回部署 Diff 数据
3. THE DevOps_Agent SHALL 生成 K8s YAML 并通过 kubeval 验证
4. THE DevOps_Agent SHALL 计算部署的影响范围 (受影响的 Pod 数量)
5. THE DevOps_Agent SHALL 生成回滚预案并展示
6. WHEN 用户审批后, THE DevOps_Agent SHALL 在沙箱中执行部署
7. THE DevOps_Agent SHALL 实时流式更新部署进度
8. THE DevOps_Agent SHALL 集成 GraphRAG 检索项目架构拓扑

### 需求 11: SRE Agent - 智能故障诊断 (含多模态)

**用户故事:** 作为 SRE，我希望 Agent 能分析告警并生成诊断树，甚至直接分析 Grafana 截图，以便快速定位根因。

#### 验收标准

1. THE SRE_Agent SHALL 接收告警并调用 showDiagnosticTree 工具返回诊断树数据
2. THE SRE_Agent SHALL 查询相关指标和日志进行多维度分析
3. THE SRE_Agent SHALL 使用 Context Caching 检索历史相似告警案例
4. THE SRE_Agent SHALL 生成根因假设并标注置信度
5. THE SRE_Agent SHALL 为每个假设生成验证步骤
6. THE SRE_Agent SHALL 生成修复建议并计算风险评分
7. WHEN 风险评分低时, THE SRE_Agent SHALL 支持自动执行修复
8. THE SRE_Agent SHALL 维护事件时间线并支持导出报告

#### 多模态增强 (Phase 1 核心功能)

9. THE SRE_Agent SHALL 接受图片输入 (PNG/JPG, max 10MB)
10. THE SRE_Agent SHALL 使用 Gemini Vision 识别截图中的错误代码、时间戳、异常波峰
11. THE SRE_Agent SHALL 提取 Grafana 图表中的指标名称和异常时间点
12. THE SRE_Agent SHALL 关联视觉信息与 Context Caching 中的代码进行根因分析
13. THE SRE_Agent SHALL 支持视频输入 (MP4, max 50MB) 用于复现步骤分析
14. THE SRE_Agent SHALL 在响应中引用截图的具体区域
15. THE SRE_Agent SHALL 记录多模态输入的处理成本和效果

### 需求 12: Multi-Tenant Isolation - 多租户隔离

**用户故事:** 作为平台管理员，我希望租户之间的 AI 数据完全隔离，以便保证数据安全。

#### 验收标准

1. THE AI_Platform SHALL 在向量数据库中按租户隔离数据
2. THE AI_Platform SHALL 在对话历史中按租户隔离数据
3. THE AI_Platform SHALL 在评估数据集中按租户隔离数据
4. THE AI_Platform SHALL 在微调模型中按租户隔离数据
5. THE AI_Platform SHALL 验证所有查询都包含租户上下文
6. THE AI_Platform SHALL 防止跨租户的数据泄露
7. THE AI_Platform SHALL 支持租户级别的数据导出和删除
8. THE AI_Platform SHALL 记录所有跨租户访问尝试

### 需求 13: Observability & Cost Analysis - 可观测性与成本分析

**用户故事:** 作为平台运营，我希望追踪每个 AI 调用的成本和质量，以便优化 ROI。

#### 验收标准

1. THE AI_Platform SHALL 记录每次调用的完整追踪 (模型、token、延迟、成本)
2. THE AI_Platform SHALL 记录每次路由决策和成本节省
3. THE AI_Platform SHALL 记录每次评估结果和质量分数
4. THE AI_Platform SHALL 计算每个租户的 AI 成本和 ROI
5. THE AI_Platform SHALL 暴露 Prometheus 指标 (调用量、成本、质量)
6. THE AI_Platform SHALL 支持按租户、模型、Agent 类型的成本分析
7. THE AI_Platform SHALL 支持成本预警和配额管理
8. THE AI_Platform SHALL 集成 Grafana 展示成本和质量趋势

### 需求 14: API & SDK - 开发者体验

**用户故事:** 作为前端开发者，我希望有类型安全的 SDK 和完整的文档，以便快速集成 AI 功能。

#### 验收标准

1. THE AI_Platform SHALL 暴露 tRPC API 提供端到端类型安全
2. THE AI_Platform SHALL 提供 TypeScript SDK 封装常用操作
3. THE AI_Platform SHALL 提供 React Hooks 用于流式 UI 集成
4. THE AI_Platform SHALL 提供完整的 API 文档和代码示例
5. THE AI_Platform SHALL 提供 Playground 用于交互式测试
6. THE AI_Platform SHALL 提供 Storybook 展示所有 Generative UI 组件
7. THE AI_Platform SHALL 支持 API 版本管理和向后兼容
8. THE AI_Platform SHALL 提供 CLI 工具用于本地开发和测试

### 需求 15: Compliance & Audit - 合规与审计

**用户故事:** 作为合规官，我希望所有 AI 操作都有完整的审计日志，以便满足监管要求。

#### 验收标准

1. THE AI_Platform SHALL 记录所有 AI 调用的完整上下文 (用户、租户、时间、输入、输出)
2. THE AI_Platform SHALL 记录所有工具调用和执行结果
3. THE AI_Platform SHALL 记录所有审批决策和理由
4. THE AI_Platform SHALL 记录所有安全事件和拦截
5. THE AI_Platform SHALL 支持审计日志的导出和归档
6. THE AI_Platform SHALL 支持审计日志的加密存储
7. THE AI_Platform SHALL 支持按时间范围和条件的审计查询
8. THE AI_Platform SHALL 集成 SIEM 系统进行实时监控

## 实施阶段 (演进式路线图)

### Phase 1: MVP 核心 (4-6 周) - Gemini-First, No-Ops
**目标**: 快速上线，验证 PMF，零运维负担

#### 里程碑 1.1: 基础设施 (2 周)
- Vercel AI SDK + Gemini Provider 集成
- Tool-Driven Dynamic UI 框架
- Context Caching 基础实现
- 基础安全防火墙 (Gemini Safety + Lakera Guard)

#### 里程碑 1.2: 核心 Agent (2 周)
- DevOps Agent (部署计划生成 + Diff 预览)
- SRE Agent (告警分析 + 多模态诊断)
- Deterministic Validation (kubeval, conftest, shellcheck)
- Human-in-the-Loop 审批流

#### 里程碑 1.3: 前端体验 (2 周)
- Vue 3 动态组件渲染
- 流式 UI 更新和错误恢复
- 多模态输入界面 (拖拽上传截图/视频)
- 基础 Observability (成本和质量追踪)

**成功标准**:
- 首个付费客户上线
- P95 延迟 < 3s
- 月 API 费用 < $500
- 用户满意度 > 4.0/5

---

### Phase 2: 规模化扩展 (8-12 周) - 触发条件达成后启动
**触发条件**: 
- 月活用户 > 100 OR
- 月 API 费用 > $5000 OR
- 客户要求私有化部署 OR
- 单个项目 > 2M Token

#### 里程碑 2.1: 高级知识工程 (4 周)
- GraphRAG 构建和增量索引
- Hybrid Search + Rerank
- 知识图谱可视化
- 智能知识路由 (Cache vs GraphRAG)

#### 里程碑 2.2: 多 Provider 容灾 (2 周)
- OpenAI/Anthropic Fallback 集成
- 自动故障切换和重试
- 跨 Provider 成本对比
- A/B 测试框架

#### 里程碑 2.3: 本地模型部署 (可选，4 周)
- Ollama/vLLM 集群部署
- Cascade Inference 实现
- GPU 资源隔离和调度
- 本地模型微调 Pipeline

#### 里程碑 2.4: 质量体系 (4 周)
- Evaluation Pipeline (Braintrust/LangSmith)
- LLM-as-Judge 评估
- Golden Dataset 构建
- Feedback Loop 和持续学习

**成功标准**:
- 支持 10+ 企业客户
- 通过模型路由节省成本 > 40%
- Agent 响应准确率 > 90%
- 系统可用性 > 99.9%

---

### Phase 3: 企业级增强 (持续迭代)
- MCP 双向协议完整实现
- 高级审批流和权限管理
- 合规审计和 SIEM 集成
- 多租户数据导出和删除
- 自定义 Agent 和工具市场

## 成功指标 (分阶段)

### Phase 1 指标 (MVP 验证)

1. **产品指标**
   - 首个付费客户上线时间 < 6 周
   - 用户留存率 (Day 7) > 40%
   - 用户满意度 > 4.0/5

2. **性能指标**
   - P95 延迟 < 3s
   - 流式首 token 延迟 (TTFT) < 300ms
   - Context Caching 命中率 > 80%

3. **成本指标**
   - 月 API 费用 < $500 (前 100 用户)
   - 单次对话平均成本 < $0.05
   - 运维工时 = 0 (完全 Serverless)

4. **安全指标**
   - 提示注入拦截率 100%
   - 敏感信息泄露事件 = 0
   - Validation 失败率 < 5%

---

### Phase 2 指标 (规模化)

1. **质量指标**
   - Agent 响应准确率 > 90%
   - 幻觉率 < 5%
   - 用户满意度 > 4.5/5

2. **性能指标**
   - P95 延迟 < 2s (优化后)
   - 系统可用性 > 99.9%
   - GraphRAG 召回率 > 85%

3. **成本指标**
   - 通过智能路由节省成本 > 40%
   - 通过 Context Caching 节省成本 > 30%
   - ROI > 3x

4. **规模指标**
   - 支持企业客户 > 10
   - 月活用户 > 1000
   - 处理项目 > 500

## 工程落地注意事项 (分阶段)

### Phase 1 关键决策

#### 1. ✅ 采纳：Context Caching 优先策略

**理由**：
- 开发周期：1 天 vs GraphRAG 的 1-2 个月
- 覆盖率：能解决 95% 的中小型项目需求
- 成本：Gemini Caching 价格极低 ($0.0125/1M cached tokens)
- 体验：超长上下文带来的理解力远超碎片化检索

**实施要点**：
- 监听 Git Webhook 自动刷新 Cache
- 实现 TTL 管理和成本优化
- 对不活跃租户允许 Cache 过期

#### 2. ✅ 采纳：Gemini-First 策略

**理由**：
- Flash 的速度 (TTFT < 300ms) 和成本 ($0.075/1M tokens) 无敌
- Pro 的多模态能力原生支持，无需额外集成
- Context Caching 是 Gemini 独有优势
- Vercel AI SDK 保证了代码层的 Provider 无关性

**风险对冲**：
- 代码层使用 SDK 抽象，切换 Provider 只需改配置
- Phase 2 引入 OpenAI/Anthropic 作为 Fallback

#### 3. ✅ 采纳：多模态优先

**理由**：
- 这是差异化竞争力（竞品大多只支持文本）
- Gemini Vision 原生支持，无需额外 OCR 服务
- 运维场景天然适合截图诊断

**实施要点**：
- 前端支持拖拽上传图片/视频
- 后端自动识别输入类型并路由到 Vision 模型
- 记录多模态输入的成本和效果

#### 4. ❌ 延后：本地模型部署

**理由**：
- 运维复杂度高（GPU 节点、模型加载、资源隔离）
- 成本伪命题（Gemini Flash 极便宜，本地 GPU 更贵）
- 开发周期长（1 个月+）

**触发条件**：
- 客户明确要求私有化部署
- 月 API 费用 > $5000 且高频低智任务占比 > 50%

#### 5. ❌ 延后：GraphRAG 完整实现

**理由**：
- 开发周期长（1-2 个月）
- 适用场景有限（项目 > 2M Token 的客户很少）
- Context Caching 已能满足大部分需求

**触发条件**：
- 出现首个超大项目客户（> 2M Token）
- Context Caching 召回率 < 80%

---

### Phase 2 关键决策

#### 6. GraphRAG 的增量索引策略

**问题:** GraphRAG 构建索引极其消耗 Token，每次代码变更都全量扫描会导致成本失控。

**解决方案:**
- 实现 **Incremental Indexing (增量索引)**
- 只解析 Git Diff 中变更的文件更新图谱
- 使用 Webhook 监听代码变更触发增量更新
- 定期（每周）做一次全量索引校验一致性
- 缓存已解析的文件指纹避免重复处理

#### 7. 本地模型的资源隔离

**问题:** Ollama 跑在 K8s 节点上，大规模构建时推理速度会骤降。

**解决方案:**
- 部署 Ollama 到 **专用节点池 (Dedicated Node Pool)**
- 使用 Node Affinity 和 Taints/Tolerations 隔离
- 配置 Resource Limits 和 QoS (Guaranteed)
- 优先使用带 GPU/NPU 的节点
- 考虑使用 Spot Instances 降低成本
- 配置 HPA 根据推理队列长度自动扩缩容

---

### 通用注意事项 (所有阶段)

#### 8. Tool-Driven UI 的组件协议 (Vue 3 特定)

**问题:** AI 需要知道有哪些工具可用及其参数定义，前端需要知道如何映射工具到组件。

**解决方案:**
- 维护强类型的 **Component Registry**
- 使用 Zod 定义每个工具的参数 schema
- 自动生成 **Tool System Prompt** 注入到 AI 上下文
- 定期验证 AI 调用的工具是否在 Registry 中
- 使用 TypeScript 确保工具参数和组件 props 类型一致

#### 9. 流式响应的错误恢复

**问题:** 流式响应中途失败时，前端已经渲染了部分内容，如何处理？

**解决方案:**
- 在流式响应中包含 **Checkpoint Markers**
- 每个 Checkpoint 标记一个完整的逻辑单元
- 失败时前端可以从最后一个 Checkpoint 重试
- 使用 `onError` 回调通知前端错误并提供重试选项
- 记录失败的流式响应用于分析和优化

#### 10. Vue 3 动态组件的性能优化

**问题:** Gemini Flash 的吐字速度极快 (>100 token/s)，前端可能跟不上。

**解决方案:**
- 使用 `json-repair` 库处理不完整的 JSON 片段
- 实现 **Throttled Rendering (节流渲染)**：每 50-100ms 更新一次
- 使用 `defineAsyncComponent` 实现组件懒加载
- 使用 `<KeepAlive>` 缓存已渲染的组件实例
- 使用 `shallowRef` 优化组件 props 的响应式性能

#### 11. 多租户的数据隔离

**问题:** Context Caching 和向量数据库都需要严格的租户隔离。

**解决方案:**
- 每个租户使用独立的 Cache Key 前缀
- 在向量 Payload 中强制包含 `tenant_id` 字段
- 所有查询都添加 `tenant_id` 过滤条件
- 实现租户数据的导出和完全删除 (GDPR 合规)
- 记录所有跨租户访问尝试

#### 12. MCP 连接的安全边界

**问题:** 用户的 Cursor IDE 直接连接平台 MCP Server 可能带来安全风险。

**解决方案:**
- 实现 **OAuth 2.0 + mTLS** 双重认证
- 每个 MCP 连接都有独立的 Token 和权限范围
- 限制 MCP 连接的速率和并发数
- 记录所有 MCP 调用的完整审计日志
- 支持 MCP 连接的实时撤销和黑名单
