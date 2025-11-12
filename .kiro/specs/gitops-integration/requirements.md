# GitOps 集成 - 需求文档

## 简介

本文档定义了将 GitOps 工作流集成到现有 AI DevOps 平台的需求。通过集成 Flux v2 并扩展现有的 repositories、deployments、environments 表，实现**双向 GitOps**：既支持传统的 Git push 触发部署，也支持通过 UI 操作自动生成 Git commit。

### 核心创新

**双向 GitOps**: 用户可以通过 UI 按钮部署（平台自动创建 Git commit），也可以直接 push 代码到 Git（Flux 自动检测并部署）。两种方式都享受 GitOps 的优势（版本控制、可审计、自动化）。

### 与现有系统的集成

本功能将无缝集成到现有架构：
- **复用 repositories 表** - 添加 GitOps 配置字段
- **复用 deployments 表** - 添加 GitOps 部署方法标识
- **复用 environments 表** - 添加环境级 GitOps 配置
- **复用 audit_logs 表** - 记录 Flux 事件
- **新增 gitops_resources 表** - 存储 Flux 资源配置（唯一新表）

## 术语表

- **平台**: AI DevOps 平台系统（现有系统）
- **GitOps**: 使用 Git 作为声明式基础设施和应用的单一真实来源的运维模式
- **双向 GitOps**: 支持 UI → Git 和 Git → 部署两个方向的工作流
- **Flux v2**: CNCF 孵化的 GitOps 工具，用于 K3s 的持续交付
- **K3s**: 轻量级 Kubernetes（平台已集成）
- **GitOps Resource**: 平台中的 Flux 资源抽象（Kustomization 或 HelmRelease）
- **Reconciliation**: Flux 将 Git 中的期望状态与 K3s 实际状态同步的过程
- **Repository**: 平台中的 Git 仓库记录（现有表）
- **Deployment**: 平台中的部署记录（现有表）
- **Environment**: 平台中的环境配置（现有表）

## 需求

### 需求 1: Flux v2 安装与配置

**用户故事:** 作为平台管理员，我希望能够在现有 K3s 集群中安装和配置 Flux v2。

#### 验收标准

1. THE 平台 SHALL 支持通过 API 在现有 K3s 集群中安装 Flux v2
2. THE 平台 SHALL 验证 Flux v2 的核心组件（source-controller、kustomize-controller、helm-controller、notification-controller）已成功部署
3. THE 平台 SHALL 将 Flux 安装状态存储在配置文件或环境变量中（不新增表）
4. WHEN Flux 组件状态异常时，THE 平台 SHALL 通过现有通知系统发送告警
5. THE 平台 SHALL 支持升级和卸载 Flux v2

### 需求 2: 扩展现有 Repository 管理

**用户故事:** 作为开发者，我希望为现有的 Git 仓库启用 GitOps 功能。

#### 验收标准

1. THE 平台 SHALL 在现有 repositories 表中添加 gitopsConfig 字段（JSONB）
2. THE 平台 SHALL 允许用户为已连接的仓库启用 GitOps
3. THE 平台 SHALL 支持 HTTPS 和 SSH 两种 Git 认证方式（复用现有认证机制）
4. THE 平台 SHALL 安全存储 Git 凭证（使用 K8s Secret）
5. THE 平台 SHALL 在现有仓库详情页显示 Flux 同步状态

### 需求 3: GitOps 资源管理（新表）

**用户故事:** 作为 DevOps 工程师，我希望为项目环境配置 GitOps 资源（Kustomization 或 Helm），以便自动应用 K8s 清单。

#### 验收标准

1. THE 平台 SHALL 创建 gitops_resources 表关联 projectId、environmentId、repositoryId
2. THE 平台 SHALL 支持创建 Kustomization 类型的 GitOps 资源
3. THE 平台 SHALL 支持创建 HelmRelease 类型的 GitOps 资源
4. THE 平台 SHALL 将所有配置（path、prune、healthChecks、values 等）存储在 config JSONB 字段
5. THE 平台 SHALL 在项目环境页面显示 GitOps 资源的 reconciliation 状态

### 需求 4: 双向 GitOps - UI 到 Git（核心创新）

**用户故事:** 作为不熟悉 Git 的用户，我希望通过 UI 按钮部署，平台自动将我的操作转换为 Git commit。

#### 验收标准

1. THE 平台 SHALL 提供可视化部署表单（镜像、副本数、环境变量等）
2. WHEN 用户通过 UI 提交部署时，THE 平台 SHALL 自动生成 K8s YAML 文件
3. THE 平台 SHALL 自动创建 Git commit 并 push 到对应的分支
4. THE 平台 SHALL 生成友好的 commit 消息（包含操作者和变更摘要）
5. THE 平台 SHALL 在现有 deployments 表中记录 deploymentMethod 为 'gitops-ui'

### 需求 5: 双向 GitOps - Git 到部署（传统 GitOps）

**用户故事:** 作为熟悉 Git 的开发者，我希望直接 push 代码到 Git，Flux 自动检测并部署。

#### 验收标准

1. WHEN 开发者 push 代码到 Git 时，Flux SHALL 自动检测变更
2. THE 平台 SHALL 通过 Flux 事件监听器接收 reconciliation 事件
3. THE 平台 SHALL 更新 repositories 表中的 fluxSyncStatus 字段
4. THE 平台 SHALL 在现有 deployments 表中创建记录，deploymentMethod 为 'gitops-git'
5. THE 平台 SHALL 在 UI 中实时显示部署进度

### 需求 6: 扩展现有 Deployment 流程

**用户故事:** 作为开发者，我希望 GitOps 部署与现有的部署流程无缝集成。

#### 验收标准

1. THE 平台 SHALL 在现有 deployments 表中添加 gitopsResourceId 和 deploymentMethod 字段
2. THE 平台 SHALL 支持三种部署方法：'manual'（现有）、'gitops-ui'（新）、'gitops-git'（新）
3. THE 平台 SHALL 在部署详情页显示 Git commit 信息（如果是 GitOps 部署）
4. THE 平台 SHALL 复用现有的审批流程（生产环境需要审批）
5. THE 平台 SHALL 在现有审计日志中记录所有 GitOps 操作

### 需求 7: HelmRelease 资源管理

**用户故事:** 作为开发者，我希望通过 Flux 管理 Helm Chart 部署。

#### 验收标准

1. THE 平台 SHALL 允许用户创建 Flux HelmRelease 资源
2. THE 平台 SHALL 支持从 Git 仓库或 Helm 仓库获取 Chart
3. THE 平台 SHALL 支持配置 Helm values（通过 JSONB 存储）
4. THE 平台 SHALL 支持配置自动升级策略
5. THE 平台 SHALL 显示 HelmRelease 的部署状态和版本信息

### 需求 5: Flux 事件监听

**用户故事:** 作为运维工程师，我希望实时接收 Flux 的同步事件。

#### 验收标准

1. THE 平台 SHALL 通过 Kubernetes Watch API 监听 Flux 资源事件
2. WHEN GitRepository 同步完成时，THE 平台 SHALL 记录事件到审计日志
3. WHEN Kustomization 应用失败时，THE 平台 SHALL 发送告警通知
4. WHEN HelmRelease 升级成功时，THE 平台 SHALL 更新部署记录
5. THE 平台 SHALL 在 UI 中实时显示 Flux 事件流

### 需求 6: 自动镜像更新

**用户故事:** 作为开发者，我希望 Flux 自动检测新镜像版本并更新部署。

#### 验收标准

1. THE 平台 SHALL 支持创建 ImageRepository 资源监控容器镜像仓库
2. THE 平台 SHALL 支持创建 ImagePolicy 资源定义镜像版本选择策略
3. THE 平台 SHALL 支持创建 ImageUpdateAutomation 资源自动更新 Git 中的镜像标签
4. THE 平台 SHALL 支持配置镜像扫描间隔
5. WHEN 检测到新镜像版本时，THE 平台 SHALL 记录到审计日志

### 需求 7: GitOps 工作流模板

**用户故事:** 作为项目管理员，我希望使用预定义的 GitOps 模板快速启动项目。

#### 验收标准

1. THE 平台 SHALL 提供常见应用类型的 GitOps 模板（Web 应用、微服务、定时任务）
2. THE 平台 SHALL 支持模板包含 GitRepository、Kustomization 和 HelmRelease 配置
3. WHEN 用户选择模板时，THE 平台 SHALL 自动生成所需的 Flux 资源
4. THE 平台 SHALL 支持用户自定义和保存 GitOps 模板
5. THE 平台 SHALL 在模板中包含最佳实践配置（健康检查、资源限制、回滚策略）

### 需求 8: 多环境 GitOps 管理

**用户故事:** 作为 DevOps 工程师，我希望为不同环境（开发、测试、生产）配置独立的 GitOps 工作流。

#### 验收标准

1. THE 平台 SHALL 支持为每个环境创建独立的 Kustomization 资源
2. THE 平台 SHALL 支持环境特定的 Git 分支或路径配置
3. THE 平台 SHALL 支持环境特定的同步策略（自动/手动）
4. WHEN 生产环境配置变更时，THE 平台 SHALL 要求审批
5. THE 平台 SHALL 显示每个环境的 GitOps 同步状态

### 需求 9: GitOps 状态可视化

**用户故事:** 作为开发者，我希望在 UI 中查看 GitOps 资源的状态和历史。

#### 验收标准

1. THE 平台 SHALL 在项目详情页显示所有 Flux 资源列表
2. THE 平台 SHALL 显示每个资源的健康状态（Ready、Reconciling、Failed）
3. THE 平台 SHALL 显示最后同步时间和下次同步时间
4. THE 平台 SHALL 显示 reconciliation 历史记录
5. THE 平台 SHALL 支持查看 Flux 资源的详细 YAML 配置

### 需求 10: 手动触发同步

**用户故事:** 作为开发者，我希望能够手动触发 Flux 同步，而不等待自动间隔。

#### 验收标准

1. THE 平台 SHALL 提供手动触发 GitRepository 同步的 API
2. THE 平台 SHALL 提供手动触发 Kustomization reconciliation 的 API
3. THE 平台 SHALL 提供手动触发 HelmRelease reconciliation 的 API
4. WHEN 手动触发同步时，THE 平台 SHALL 记录操作到审计日志
5. THE 平台 SHALL 在 UI 中显示同步进度和结果

### 需求 11: GitOps 回滚

**用户故事:** 作为运维工程师，我希望能够回滚到之前的 Git 提交版本。

#### 验收标准

1. THE 平台 SHALL 记录每次成功部署的 Git commit SHA
2. THE 平台 SHALL 允许用户选择历史版本进行回滚
3. WHEN 用户触发回滚时，THE 平台 SHALL 更新 Kustomization 的 sourceRef 到指定 commit
4. THE 平台 SHALL 等待 Flux 完成 reconciliation 并验证回滚成功
5. THE 平台 SHALL 记录回滚操作到审计日志和部署历史

### 需求 12: Flux 健康检查

**用户故事:** 作为平台管理员，我希望监控 Flux 组件的健康状态。

#### 验收标准

1. THE 平台 SHALL 定期检查 Flux 核心组件的 Pod 状态
2. THE 平台 SHALL 收集 Flux 组件的资源使用指标（CPU、内存）
3. WHEN Flux 组件 Pod 重启次数超过阈值时，THE 平台 SHALL 发送告警
4. THE 平台 SHALL 在监控仪表板中显示 Flux 健康状态
5. THE 平台 SHALL 支持查看 Flux 组件的日志

### 需求 13: GitOps 权限控制

**用户故事:** 作为安全工程师，我希望控制谁可以创建和修改 GitOps 资源。

#### 验收标准

1. THE 平台 SHALL 要求用户具有项目 maintainer 或更高权限才能创建 Flux 资源
2. THE 平台 SHALL 要求用户具有环境部署权限才能修改该环境的 Kustomization
3. THE 平台 SHALL 记录所有 GitOps 资源的创建、修改、删除操作到审计日志
4. THE 平台 SHALL 支持配置生产环境的 GitOps 操作需要双人审批
5. THE 平台 SHALL 在权限不足时返回明确的错误信息

### 需求 14: Flux 通知集成

**用户故事:** 作为团队负责人，我希望在 Flux 同步失败时收到通知。

#### 验收标准

1. THE 平台 SHALL 配置 Flux Notification Controller 发送事件到平台 webhook
2. WHEN Flux 资源 reconciliation 失败时，THE 平台 SHALL 创建通知
3. THE 平台 SHALL 支持配置通知渠道（邮件、应用内、Slack）
4. THE 平台 SHALL 支持配置通知规则（仅失败、所有事件、特定资源）
5. THE 平台 SHALL 在通知中包含错误详情和修复建议

### 需求 15: GitOps 配置验证

**用户故事:** 作为开发者，我希望在应用 GitOps 配置前验证其正确性。

#### 验收标准

1. THE 平台 SHALL 在创建 Flux 资源前验证 YAML 语法
2. THE 平台 SHALL 验证引用的 GitRepository 是否存在
3. THE 平台 SHALL 验证 Git 仓库路径和分支是否有效
4. THE 平台 SHALL 验证 Helm Chart 名称和版本是否存在
5. WHEN 验证失败时，THE 平台 SHALL 返回详细的错误信息

### 需求 16: Flux 资源依赖管理

**用户故事:** 作为 DevOps 工程师，我希望定义 Flux 资源之间的依赖关系。

#### 验收标准

1. THE 平台 SHALL 支持在 Kustomization 中配置 dependsOn 字段
2. THE 平台 SHALL 确保依赖的资源先于当前资源 reconcile
3. THE 平台 SHALL 在 UI 中可视化资源依赖关系图
4. WHEN 依赖资源失败时，THE 平台 SHALL 暂停当前资源的 reconciliation
5. THE 平台 SHALL 支持配置依赖超时时间

### 需求 17: GitOps 成本追踪

**用户故事:** 作为财务分析师，我希望追踪通过 GitOps 部署的资源成本。

#### 验收标准

1. THE 平台 SHALL 解析 Kustomization 和 HelmRelease 中的资源请求
2. THE 平台 SHALL 计算每个 GitOps 部署的预估成本
3. THE 平台 SHALL 将 GitOps 部署成本关联到项目成本追踪
4. THE 平台 SHALL 在成本仪表板中显示 GitOps 部署的成本占比
5. WHEN GitOps 部署导致成本超出预算时，THE 平台 SHALL 发送告警

### 需求 18: Flux 多集群支持

**用户故事:** 作为平台架构师，我希望在多个 K8s 集群中部署 Flux。

#### 验收标准

1. THE 平台 SHALL 支持在多个 K8s 集群中独立安装 Flux
2. THE 平台 SHALL 为每个集群维护独立的 Flux 配置
3. THE 平台 SHALL 支持跨集群的 GitOps 资源管理
4. THE 平台 SHALL 在 UI 中按集群分组显示 Flux 资源
5. THE 平台 SHALL 支持将相同的 GitOps 配置应用到多个集群

### 需求 19: GitOps 灾难恢复

**用户故事:** 作为 SRE 工程师，我希望能够快速恢复 GitOps 配置。

#### 验收标准

1. THE 平台 SHALL 定期备份所有 Flux 资源配置
2. THE 平台 SHALL 支持导出 Flux 资源为 YAML 文件
3. THE 平台 SHALL 支持从备份恢复 Flux 资源
4. WHEN Flux 组件故障时，THE 平台 SHALL 提供重新安装和恢复配置的向导
5. THE 平台 SHALL 验证恢复后的 Flux 资源状态

### 需求 20: GitOps 最佳实践检查

**用户故事:** 作为平台工程师，我希望系统自动检查 GitOps 配置是否符合最佳实践。

#### 验收标准

1. THE 平台 SHALL 检查 Kustomization 是否配置了健康检查
2. THE 平台 SHALL 检查 HelmRelease 是否配置了资源限制
3. THE 平台 SHALL 检查生产环境是否启用了 prune 保护
4. THE 平台 SHALL 检查是否配置了合理的同步间隔
5. WHEN 检测到不符合最佳实践时，THE 平台 SHALL 在 UI 中显示警告和改进建议

### 需求 21: Flux 性能优化

**用户故事:** 作为平台管理员，我希望优化 Flux 的性能和资源使用。

#### 验收标准

1. THE 平台 SHALL 支持配置 Flux 组件的资源请求和限制
2. THE 平台 SHALL 支持配置 Flux 的并发 reconciliation 数量
3. THE 平台 SHALL 监控 Flux reconciliation 的平均耗时
4. WHEN Flux reconciliation 耗时超过阈值时，THE 平台 SHALL 发送告警
5. THE 平台 SHALL 提供 Flux 性能优化建议

### 需求 22: GitOps 文档生成

**用户故事:** 作为技术文档工程师，我希望自动生成 GitOps 配置文档。

#### 验收标准

1. THE 平台 SHALL 自动生成项目的 GitOps 架构文档
2. THE 平台 SHALL 在文档中包含所有 Flux 资源的配置说明
3. THE 平台 SHALL 生成资源依赖关系图
4. THE 平台 SHALL 支持导出文档为 Markdown 或 PDF 格式
5. THE 平台 SHALL 在配置变更时自动更新文档

### 需求 23: Flux 版本管理

**用户故事:** 作为平台管理员，我希望管理 Flux 的版本升级。

#### 验收标准

1. THE 平台 SHALL 检测 Flux 的可用新版本
2. THE 平台 SHALL 显示当前版本和最新版本的差异
3. THE 平台 SHALL 支持通过 UI 触发 Flux 升级
4. THE 平台 SHALL 在升级前备份当前配置
5. WHEN Flux 升级失败时，THE 平台 SHALL 支持回滚到之前版本

### 需求 24: GitOps 合规检查

**用户故事:** 作为合规官，我希望确保 GitOps 部署符合安全和合规要求。

#### 验收标准

1. THE 平台 SHALL 检查 GitOps 配置是否违反安全策略
2. THE 平台 SHALL 验证部署的镜像是否来自可信仓库
3. THE 平台 SHALL 检查是否配置了镜像扫描
4. WHEN 检测到合规违规时，THE 平台 SHALL 阻止部署并记录到审计日志
5. THE 平台 SHALL 生成 GitOps 合规报告

### 需求 25: Flux 故障排查

**用户故事:** 作为开发者，我希望快速诊断 GitOps 同步失败的原因。

#### 验收标准

1. THE 平台 SHALL 收集 Flux 资源的 status 和 conditions 信息
2. THE 平台 SHALL 提供常见错误的诊断建议
3. THE 平台 SHALL 支持查看 Flux 组件的详细日志
4. THE 平台 SHALL 提供交互式故障排查向导
5. THE 平台 SHALL 在 UI 中高亮显示错误的配置项
