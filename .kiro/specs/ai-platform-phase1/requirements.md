# AI Platform Phase 1 MVP 需求文档

## 简介

AI Platform Phase 1 是一个 **Gemini-First, No-Ops** 的 MVP 版本，专注于快速验证产品市场契合度（PMF）。核心理念：**AI 通过工具调用生成可交互的动态界面，而不是传统的文本对话**。

### Phase 1 技术栈

| 组件 | 技术选型 | 版本 | 核心能力 |
|------|----------|------|----------|
| **AI SDK** | Vercel AI SDK (Vue) | 6.0.14 | Tool-Driven Dynamic UI + Stream |
| **前端框架** | Vue 3 + Pinia | 3.5+ | 动态组件 + 响应式状态 |
| **Primary Provider** | **Google Gemini** | 1.5 | Flash (快速路径) + Pro (深度路径) |
| **知识引擎** | **Context Caching** | - | 超长上下文 (2M Token) |
| **多模态** | **Gemini Vision** | - | 图片/视频分析 |
| **Safety** | Gemini Safety + Lakera Guard | - | 双层防火墙 |
| **UI 组件库** | Shadcn-vue / Naive UI | - | 高质量交互组件 |

### 架构原则

1. **Tool-Driven Dynamic UI**: AI 通过工具调用生成结构化数据，前端动态渲染 Vue 组件
2. **Deterministic Validation**: 所有 AI 生成的代码必须经过确定性验证
3. **Context Over Retrieval**: 优先使用超长上下文，避免碎片化检索
4. **Multimodal First**: 原生支持图片/视频输入
5. **Serverless Ops**: 完全依赖云端 API，零运维负担
6. **Safety by Design**: 输入/输出实时防火墙

## 术语表

- **Tool_Driven_Dynamic_UI**: AI 通过工具调用返回结构化数据，前端根据工具名动态渲染 Vue 组件
- **Component_Registry**: 前端维护的组件映射表，将工具名映射到 Vue 组件
- **Context_Caching**: Gemini 的超长上下文缓存机制，支持 2M Token 的项目级知识存储
- **Multimodal_Input**: 支持文本、图片、视频等多种输入形式
- **Deterministic_Validation**: 对 AI 生成内容进行确定性验证（kubeval, conftest, shellcheck）
- **Gemini_Flash**: Gemini 1.5 Flash 模型，用于快速路径（UI 生成、简单查询）
- **Gemini_Pro**: Gemini 1.5 Pro 模型，用于深度路径（代码重构、根因分析）
- **HITL**: Human-in-the-Loop，人工审批流程
- **TTFT**: Time To First Token，首 token 延迟

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

### 需求 2: Context Caching - 超长上下文知识引擎

**用户故事:** 作为平台用户，我希望 AI 能理解我的整个项目，而不是只看到搜索出来的几段话。

#### 验收标准

1. THE Knowledge_Engine SHALL 使用 **Gemini Context Caching** 作为主要知识存储方案
2. THE Knowledge_Engine SHALL 支持将租户的代码库、文档一次性缓存到 Gemini (最大 2M Token)
3. WHEN 代码库有 Git Push 事件时, THE Knowledge_Engine SHALL 自动刷新 Cache
4. THE Knowledge_Engine SHALL 管理 Cache 的 TTL (Time-To-Live) 和续期策略
5. THE Knowledge_Engine SHALL 对不活跃租户允许 Cache 过期以节省成本
6. THE Knowledge_Engine SHALL 记录每次 Cache 操作的成本和命中率
7. THE Knowledge_Engine SHALL 在 Cache 失败时返回明确的错误信息
8. THE Knowledge_Engine SHALL 支持 Cache 的增量更新（仅更新变更文件）

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

### 需求 4: Human-in-the-Loop - 智能审批流

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

### 需求 5: Intelligent Model Router - 智能模型路由

**用户故事:** 作为平台运营，我希望简单任务用快速模型，复杂任务用强大模型，以便降低成本。

#### 验收标准

1. THE AI_Platform SHALL 使用 **Gemini 1.5 Flash** 处理快速路径 (UI 生成、简单查询、意图识别)
2. THE AI_Platform SHALL 使用 **Gemini 1.5 Pro** 处理深度路径 (代码重构、根因分析、全库审计)
3. THE AI_Platform SHALL 根据任务复杂度自动路由到 Flash 或 Pro
4. THE AI_Platform SHALL 记录每个路由决策和成本
5. THE AI_Platform SHALL 支持基于延迟的动态路由 (TTFT < 300ms 用 Flash)
6. THE AI_Platform SHALL 计算每个路由策略的成本效益比
7. THE AI_Platform SHALL 支持租户级别的模型偏好设置

### 需求 6: Safety Guardrails - 实时安全防火墙

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

### 需求 7: DevOps Agent - 智能部署助手

**用户故事:** 作为 DevOps 工程师，我希望 Agent 能生成部署计划并预览变更，以便我审批后执行。

#### 验收标准

1. THE DevOps_Agent SHALL 理解自然语言部署需求并生成结构化计划
2. THE DevOps_Agent SHALL 调用 showDeploymentDiff 工具返回部署 Diff 数据
3. THE DevOps_Agent SHALL 生成 K8s YAML 并通过 kubeval 验证
4. THE DevOps_Agent SHALL 计算部署的影响范围 (受影响的 Pod 数量)
5. THE DevOps_Agent SHALL 生成回滚预案并展示
6. WHEN 用户审批后, THE DevOps_Agent SHALL 在沙箱中执行部署
7. THE DevOps_Agent SHALL 实时流式更新部署进度
8. THE DevOps_Agent SHALL 使用 Context Caching 检索项目架构信息

### 需求 8: SRE Agent - 智能故障诊断 (含多模态)

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

#### 多模态增强

9. THE SRE_Agent SHALL 接受图片输入 (PNG/JPG, max 10MB)
10. THE SRE_Agent SHALL 使用 Gemini Vision 识别截图中的错误代码、时间戳、异常波峰
11. THE SRE_Agent SHALL 提取 Grafana 图表中的指标名称和异常时间点
12. THE SRE_Agent SHALL 关联视觉信息与 Context Caching 中的代码进行根因分析
13. THE SRE_Agent SHALL 支持视频输入 (MP4, max 50MB) 用于复现步骤分析
14. THE SRE_Agent SHALL 在响应中引用截图的具体区域
15. THE SRE_Agent SHALL 记录多模态输入的处理成本和效果

### 需求 9: Multi-Tenant Isolation - 多租户隔离

**用户故事:** 作为平台管理员，我希望租户之间的 AI 数据完全隔离，以便保证数据安全。

#### 验收标准

1. THE AI_Platform SHALL 在 Context Caching 中按租户隔离数据
2. THE AI_Platform SHALL 在对话历史中按租户隔离数据
3. THE AI_Platform SHALL 验证所有查询都包含租户上下文
4. THE AI_Platform SHALL 防止跨租户的数据泄露
5. THE AI_Platform SHALL 支持租户级别的数据导出和删除
6. THE AI_Platform SHALL 记录所有跨租户访问尝试

### 需求 10: Observability & Cost Analysis - 可观测性与成本分析

**用户故事:** 作为平台运营，我希望追踪每个 AI 调用的成本和质量，以便优化 ROI。

#### 验收标准

1. THE AI_Platform SHALL 记录每次调用的完整追踪 (模型、token、延迟、成本)
2. THE AI_Platform SHALL 记录每次路由决策和成本节省
3. THE AI_Platform SHALL 计算每个租户的 AI 成本和 ROI
4. THE AI_Platform SHALL 暴露 Prometheus 指标 (调用量、成本、质量)
5. THE AI_Platform SHALL 支持按租户、模型、Agent 类型的成本分析
6. THE AI_Platform SHALL 支持成本预警和配额管理
7. THE AI_Platform SHALL 集成 Grafana 展示成本和质量趋势

### 需求 11: API & SDK - 开发者体验

**用户故事:** 作为前端开发者，我希望有类型安全的 SDK 和完整的文档，以便快速集成 AI 功能。

#### 验收标准

1. THE AI_Platform SHALL 暴露 tRPC API 提供端到端类型安全
2. THE AI_Platform SHALL 提供 TypeScript SDK 封装常用操作
3. THE AI_Platform SHALL 提供 Vue Composables 用于流式 UI 集成
4. THE AI_Platform SHALL 提供完整的 API 文档和代码示例
5. THE AI_Platform SHALL 提供 Playground 用于交互式测试
6. THE AI_Platform SHALL 提供 Storybook 展示所有 Generative UI 组件
7. THE AI_Platform SHALL 支持 API 版本管理和向后兼容

### 需求 12: Compliance & Audit - 合规与审计

**用户故事:** 作为合规官，我希望所有 AI 操作都有完整的审计日志，以便满足监管要求。

#### 验收标准

1. THE AI_Platform SHALL 记录所有 AI 调用的完整上下文 (用户、租户、时间、输入、输出)
2. THE AI_Platform SHALL 记录所有工具调用和执行结果
3. THE AI_Platform SHALL 记录所有审批决策和理由
4. THE AI_Platform SHALL 记录所有安全事件和拦截
5. THE AI_Platform SHALL 支持审计日志的导出和归档
6. THE AI_Platform SHALL 支持审计日志的加密存储
7. THE AI_Platform SHALL 支持按时间范围和条件的审计查询

## 实施里程碑 (4-6 周)

### 里程碑 1.1: 基础设施 (2 周)
- Vercel AI SDK + Gemini Provider 集成
- Tool-Driven Dynamic UI 框架
- Context Caching 基础实现
- 基础安全防火墙 (Gemini Safety + Lakera Guard)

### 里程碑 1.2: 核心 Agent (2 周)
- DevOps Agent (部署计划生成 + Diff 预览)
- SRE Agent (告警分析 + 多模态诊断)
- Deterministic Validation (kubeval, conftest, shellcheck)
- Human-in-the-Loop 审批流

### 里程碑 1.3: 前端体验 (2 周)
- Vue 3 动态组件渲染
- 流式 UI 更新和错误恢复
- 多模态输入界面 (拖拽上传截图/视频)
- 基础 Observability (成本和质量追踪)

## 成功指标

### 产品指标
- 首个付费客户上线时间 < 6 周
- 用户留存率 (Day 7) > 40%
- 用户满意度 > 4.0/5

### 性能指标
- P95 延迟 < 3s
- 流式首 token 延迟 (TTFT) < 300ms
- Context Caching 命中率 > 80%

### 成本指标
- 月 API 费用 < $500 (前 100 用户)
- 单次对话平均成本 < $0.05
- 运维工时 = 0 (完全 Serverless)

### 安全指标
- 提示注入拦截率 100%
- 敏感信息泄露事件 = 0
- Validation 失败率 < 5%

## 工程落地注意事项

### 1. Context Caching 优先策略

**理由**：
- 开发周期：1 天 vs GraphRAG 的 1-2 个月
- 覆盖率：能解决 95% 的中小型项目需求
- 成本：Gemini Caching 价格极低 ($0.0125/1M cached tokens)
- 体验：超长上下文带来的理解力远超碎片化检索

**实施要点**：
- 监听 Git Webhook 自动刷新 Cache
- 实现 TTL 管理和成本优化
- 对不活跃租户允许 Cache 过期

### 2. Gemini-First 策略

**理由**：
- Flash 的速度 (TTFT < 300ms) 和成本 ($0.075/1M tokens) 无敌
- Pro 的多模态能力原生支持，无需额外集成
- Context Caching 是 Gemini 独有优势
- Vercel AI SDK 保证了代码层的 Provider 无关性

**风险对冲**：
- 代码层使用 SDK 抽象，切换 Provider 只需改配置

### 3. 多模态优先

**理由**：
- 这是差异化竞争力（竞品大多只支持文本）
- Gemini Vision 原生支持，无需额外 OCR 服务
- 运维场景天然适合截图诊断

**实施要点**：
- 前端支持拖拽上传图片/视频
- 后端自动识别输入类型并路由到 Vision 模型
- 记录多模态输入的成本和效果

### 4. Tool-Driven UI 的组件协议

**问题:** AI 需要知道有哪些工具可用及其参数定义，前端需要知道如何映射工具到组件。

**解决方案:**
- 维护强类型的 **Component Registry**
- 使用 Zod 定义每个工具的参数 schema
- 自动生成 **Tool System Prompt** 注入到 AI 上下文
- 定期验证 AI 调用的工具是否在 Registry 中
- 使用 TypeScript 确保工具参数和组件 props 类型一致

### 5. 流式响应的错误恢复

**问题:** 流式响应中途失败时，前端已经渲染了部分内容，如何处理？

**解决方案:**
- 在流式响应中包含 **Checkpoint Markers**
- 每个 Checkpoint 标记一个完整的逻辑单元
- 失败时前端可以从最后一个 Checkpoint 重试
- 使用 `onError` 回调通知前端错误并提供重试选项
- 记录失败的流式响应用于分析和优化

### 6. Vue 3 动态组件的性能优化

**问题:** Gemini Flash 的吐字速度极快 (>100 token/s)，前端可能跟不上。

**解决方案:**
- 使用 `json-repair` 库处理不完整的 JSON 片段
- 实现 **Throttled Rendering (节流渲染)**：每 50-100ms 更新一次
- 使用 `defineAsyncComponent` 实现组件懒加载
- 使用 `<KeepAlive>` 缓存已渲染的组件实例
- 使用 `shallowRef` 优化组件 props 的响应式性能

### 7. 多租户的数据隔离

**问题:** Context Caching 需要严格的租户隔离。

**解决方案:**
- 每个租户使用独立的 Cache Key 前缀
- 所有查询都添加 `tenant_id` 过滤条件
- 实现租户数据的导出和完全删除 (GDPR 合规)
- 记录所有跨租户访问尝试
