# AI DevOps 平台 - 需求文档

## 简介

本文档定义了从零开始构建的 AI DevOps 平台的需求。基于现有的 **NestJS 11 + tRPC 11 + Drizzle + Bun** 技术栈，采用精简架构设计，专注于核心功能。

## 术语表

- **系统**: AI DevOps 平台
- **组织**: 多租户系统中的顶层实体
- **项目**: 组织内的独立应用或服务
- **环境**: 项目的部署目标（开发、测试、生产等）
- **Pipeline**: CI/CD 流水线
- **部署**: 将代码发布到特定环境的操作

## 需求

### 需求 1: 用户认证与授权

**用户故事:** 作为用户，我希望能够通过 GitHub 或 GitLab 登录系统。

#### 验收标准

1. THE 系统 SHALL 支持 GitHub OAuth 登录
2. THE 系统 SHALL 支持 GitLab OAuth 登录
3. THE 系统 SHALL 使用 JWT 进行会话管理
4. THE 系统 SHALL 将会话数据存储在 Redis 中
5. WHEN 用户登录时，THE 系统 SHALL 记录登录时间和 IP 地址到审计日志

### 需求 2: 组织管理

**用户故事:** 作为用户，我希望创建和管理组织，以便团队协作。

#### 验收标准

1. WHEN 用户创建组织时，THE 系统 SHALL 自动将创建者设置为组织所有者
2. THE 系统 SHALL 支持组织角色：owner、admin、member
3. THE 系统 SHALL 允许组织所有者邀请新成员
4. THE 系统 SHALL 支持组织配额限制（项目数、用户数、存储）
5. WHEN 组织被删除时，THE 系统 SHALL 使用软删除（deletedAt）保留数据

### 需求 3: 团队管理

**用户故事:** 作为组织管理员，我希望创建团队来组织成员。

#### 验收标准

1. THE 系统 SHALL 允许在组织内创建多个团队
2. THE 系统 SHALL 确保团队 slug 在组织内唯一
3. THE 系统 SHALL 支持团队角色：owner、maintainer、member
4. THE 系统 SHALL 允许团队关联到多个项目
5. WHEN 团队被删除时，THE 系统 SHALL 使用软删除保留数据

### 需求 4: 项目管理

**用户故事:** 作为开发者，我希望创建和管理项目。

#### 验收标准

1. THE 系统 SHALL 允许在组织内创建多个项目
2. THE 系统 SHALL 支持项目可见性：public、private、internal
3. THE 系统 SHALL 支持项目状态：active、inactive、archived
4. THE 系统 SHALL 支持项目配置（JSONB 存储）
5. WHEN 项目被删除时，THE 系统 SHALL 使用软删除保留数据

### 需求 5: 权限管理

**用户故事:** 作为系统架构师，我希望有清晰的权限模型。

#### 验收标准

1. THE 系统 SHALL 支持三级权限：组织级、团队级、项目级
2. THE 系统 SHALL 支持权限继承：组织管理员自动拥有所有项目权限
3. THE 系统 SHALL 支持直接授权和团队授权
4. THE 系统 SHALL 在权限冲突时采用最高权限原则
5. WHEN 查询用户权限时，THE 系统 SHALL 在 100ms 内返回结果

### 需求 6: 代码仓库集成

**用户故事:** 作为开发者，我希望连接 Git 仓库到项目。

#### 验收标准

1. THE 系统 SHALL 支持 GitHub 和 GitLab 仓库
2. THE 系统 SHALL 存储仓库的基本信息和同步状态
3. WHEN 仓库有新提交时，THE 系统 SHALL 通过 webhook 接收通知
4. THE 系统 SHALL 支持分支保护规则配置（JSONB 存储）
5. THE 系统 SHALL 定期同步仓库元数据

### 需求 7: CI/CD Pipeline

**用户故事:** 作为 DevOps 工程师，我希望配置 CI/CD 流水线。

#### 验收标准

1. THE 系统 SHALL 支持通过 YAML 或 JSONB 定义 pipeline 配置
2. THE 系统 SHALL 支持触发方式：push、pull_request、schedule、manual
3. THE 系统 SHALL 记录每次 pipeline 运行的状态和日志
4. THE 系统 SHALL 支持 pipeline 状态：pending、running、success、failed、cancelled
5. WHEN pipeline 失败时，THE 系统 SHALL 发送通知

### 需求 8: 环境管理

**用户故事:** 作为运维工程师，我希望管理不同的部署环境。

#### 验收标准

1. THE 系统 SHALL 支持环境类型：development、staging、production、testing
2. THE 系统 SHALL 为每个环境配置独立的访问权限（JSONB 数组存储）
3. THE 系统 SHALL 支持环境配置（JSONB 存储）
4. THE 系统 SHALL 记录环境的健康状态
5. WHEN 环境被删除时，THE 系统 SHALL 使用软删除保留数据

### 需求 9: 部署管理

**用户故事:** 作为开发者，我希望将应用部署到不同环境。

#### 验收标准

1. THE 系统 SHALL 记录每次部署的版本、提交哈希、分支信息
2. THE 系统 SHALL 支持部署策略：rolling、blue_green、canary
3. THE 系统 SHALL 支持部署状态：pending、running、success、failed、rolled_back
4. WHEN 生产环境部署时，THE 系统 SHALL 要求审批
5. THE 系统 SHALL 支持一键回滚

### 需求 10: 部署审批工作流

**用户故事:** 作为 DevOps 经理，我希望配置部署审批流程。

#### 验收标准

1. THE 系统 SHALL 允许为每个环境配置审批要求（JSONB 存储）
2. THE 系统 SHALL 支持配置最少审批人数
3. WHEN 部署需要审批时，THE 系统 SHALL 创建审批请求并通知审批人
4. THE 系统 SHALL 允许审批人批准、拒绝或请求变更
5. THE 系统 SHALL 在所有必需审批完成后才允许部署执行

### 需求 11: 成本追踪

**用户故事:** 作为财务分析师，我希望追踪项目的云资源成本。

#### 验收标准

1. THE 系统 SHALL 按日记录项目的成本数据
2. THE 系统 SHALL 支持成本分类（JSONB 存储）：计算、存储、网络、数据库
3. THE 系统 SHALL 提供月度和季度成本汇总
4. THE 系统 SHALL 支持成本预算设置
5. WHEN 成本超过预算 90% 时，THE 系统 SHALL 发送告警

### 需求 12: 安全策略

**用户故事:** 作为安全工程师，我希望定义和执行安全策略。

#### 验收标准

1. THE 系统 SHALL 支持定义安全策略规则（JSONB 存储）
2. THE 系统 SHALL 支持策略类型：访问控制、网络、数据保护、合规
3. WHEN 操作违反安全策略时，THE 系统 SHALL 阻止操作或记录警告
4. THE 系统 SHALL 记录所有安全违规到审计日志
5. THE 系统 SHALL 提供合规报告导出功能

### 需求 13: 事件与审计日志

**用户故事:** 作为系统管理员，我希望查看所有重要操作的审计日志。

#### 验收标准

1. THE 系统 SHALL 记录所有关键操作到审计日志
2. THE 系统 SHALL 记录操作的用户、时间、IP 地址、资源类型和资源 ID
3. THE 系统 SHALL 支持按时间范围、用户、资源类型筛选日志
4. THE 系统 SHALL 保留审计日志至少 90 天
5. THE 系统 SHALL 支持审计日志导出为 CSV 或 JSON 格式

### 需求 14: 通知系统

**用户故事:** 作为用户，我希望通过多种渠道接收重要事件的通知。

#### 验收标准

1. THE 系统 SHALL 支持通知渠道：邮件、应用内通知
2. THE 系统 SHALL 支持通知类型：部署成功/失败、审批请求、成本告警
3. THE 系统 SHALL 允许用户配置通知偏好（JSONB 存储）
4. THE 系统 SHALL 支持通知优先级：low、normal、high、urgent
5. WHEN 通知发送失败时，THE 系统 SHALL 自动重试最多 3 次

### 需求 15: AI 助手

**用户故事:** 作为开发者，我希望使用 AI 助手帮助我优化代码和部署流程。

#### 验收标准

1. THE 系统 SHALL 支持多种 AI 助手类型：代码审查、DevOps 工程师、成本优化
2. THE 系统 SHALL 支持配置 AI 模型提供商（JSONB 存储）：OpenAI、Anthropic、Google
3. THE 系统 SHALL 记录 AI 助手的使用次数和平均评分
4. THE 系统 SHALL 允许用户对 AI 响应进行评分（1-5 星）
5. THE 系统 SHALL 支持组织级和个人级 AI 助手配置

### 需求 16: 分布式追踪 (OpenTelemetry)

**用户故事:** 作为平台工程师，我希望有完整的分布式追踪系统，以便监控和调试系统性能。

#### 验收标准

1. THE 系统 SHALL 使用 OpenTelemetry SDK 收集追踪数据
2. THE 系统 SHALL 自动追踪 HTTP 请求、数据库查询和外部 API 调用
3. THE 系统 SHALL 支持自定义 Span 和追踪属性
4. THE 系统 SHALL 通过 OTLP 协议导出追踪数据到 Jaeger 或 Zipkin
5. WHEN 请求发生错误时，THE 系统 SHALL 在 Span 中记录完整的错误堆栈

### 需求 17: 业务指标收集

**用户故事:** 作为运维工程师，我希望收集关键业务指标，以便监控系统健康状况。

#### 验收标准

1. THE 系统 SHALL 通过 Prometheus 格式暴露指标
2. THE 系统 SHALL 收集 HTTP 请求指标：请求数、延迟、错误率
3. THE 系统 SHALL 收集数据库指标：查询数、延迟、连接池状态
4. THE 系统 SHALL 收集业务指标：部署数、Pipeline 运行数、用户活跃度
5. THE 系统 SHALL 在独立端口（9464）暴露 /metrics 端点

### 需求 18: 追踪上下文传播

**用户故事:** 作为系统架构师，我希望追踪上下文在服务间传播，以便跟踪完整的请求链路。

#### 验收标准

1. THE 系统 SHALL 在 HTTP 请求头中传播 W3C Trace Context
2. THE 系统 SHALL 在 tRPC 调用中传播追踪上下文
3. THE 系统 SHALL 在异步任务（BullMQ）中传播追踪上下文
4. THE 系统 SHALL 在日志中注入 Trace ID 和 Span ID
5. THE 系统 SHALL 支持从外部请求中提取追踪上下文

### 需求 19: 自动化测试框架 (Vitest)

**用户故事:** 作为开发者，我希望有现代化的测试框架，以便快速编写和运行测试。

#### 验收标准

1. THE 系统 SHALL 使用 Vitest 作为测试框架
2. THE 系统 SHALL 支持单元测试和集成测试
3. THE 系统 SHALL 配置测试覆盖率收集，目标覆盖率 80%
4. THE 系统 SHALL 支持并行运行测试，提高测试速度
5. THE 系统 SHALL 提供测试工具函数：数据工厂、Mock 辅助、断言辅助

### 需求 20: 单元测试

**用户故事:** 作为开发者，我希望为核心服务编写单元测试，以便验证业务逻辑正确性。

#### 验收标准

1. THE 系统 SHALL 为所有服务类提供单元测试
2. THE 系统 SHALL 使用 Mock 隔离外部依赖（数据库、Redis、外部 API）
3. THE 系统 SHALL 测试正常流程和异常流程
4. THE 系统 SHALL 测试边界条件和错误处理
5. THE 系统 SHALL 确保单元测试运行时间 < 5 秒

### 需求 21: 集成测试

**用户故事:** 作为 QA 工程师，我希望有集成测试，以便验证模块间协作正确性。

#### 验收标准

1. THE 系统 SHALL 为关键 API 端点提供集成测试
2. THE 系统 SHALL 使用测试数据库，在测试前后自动清理
3. THE 系统 SHALL 测试完整的请求-响应流程
4. THE 系统 SHALL 测试认证和权限检查
5. THE 系统 SHALL 测试数据库事务和并发场景

### 需求 22: CI/CD 集成

**用户故事:** 作为 DevOps 工程师，我希望测试集成到 CI/CD 流程，以便自动化质量检查。

#### 验收标准

1. THE 系统 SHALL 支持 GitHub Actions 和 GitLab CI 配置
2. WHEN 提交代码时，THE 系统 SHALL 自动运行所有测试
3. WHEN 测试失败时，THE 系统 SHALL 阻止合并请求
4. THE 系统 SHALL 生成测试覆盖率报告并上传到 CI
5. THE 系统 SHALL 在 PR/MR 中显示测试结果和覆盖率变化

### 需求 23: GitLab CI/CD 支持

**用户故事:** 作为使用 GitLab 的团队，我希望系统完整支持 GitLab CI/CD 功能。

#### 验收标准

1. THE 系统 SHALL 支持 GitLab CI/CD pipeline 配置（.gitlab-ci.yml）
2. THE 系统 SHALL 通过 GitLab API 触发和监控 pipeline 运行
3. THE 系统 SHALL 接收 GitLab webhook 事件（push、merge_request、pipeline）
4. THE 系统 SHALL 支持 GitLab 环境和部署功能
5. THE 系统 SHALL 显示 GitLab pipeline 状态和日志

### 需求 24: 可观测性仪表板

**用户故事:** 作为运维工程师，我希望有可视化仪表板，以便监控系统状态。

#### 验收标准

1. THE 系统 SHALL 提供 Grafana 仪表板配置模板
2. THE 系统 SHALL 展示请求延迟、错误率、吞吐量
3. THE 系统 SHALL 展示数据库性能、连接池状态
4. THE 系统 SHALL 展示业务指标（部署数、用户数）
5. THE 系统 SHALL 支持告警规则，在异常时发送通知

### 需求 25: 监控告警

**用户故事:** 作为 SRE 工程师，我希望有自动化告警，以便及时发现和响应问题。

#### 验收标准

1. THE 系统 SHALL 配置 Prometheus 告警规则
2. WHEN 错误率超过 5% 时，THE 系统 SHALL 发送告警
3. WHEN 响应时间 P95 超过 1 秒时，THE 系统 SHALL 发送告警
4. WHEN 资源使用超过 80% 时，THE 系统 SHALL 发送告警
5. THE 系统 SHALL 支持多种告警渠道（邮件、Slack、PagerDuty）
