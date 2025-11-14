# 项目创建流程审查与优化 - 需求文档

## 简介

本需求文档专注于审查和修复项目创建时前后端的核心流程问题，确保从用户点击"创建项目"到项目成功初始化的整个过程稳定可靠。

## 术语表

- **ProjectWizard**: 前端项目创建向导组件
- **ProjectOrchestrator**: 后端项目编排服务，负责协调项目创建的各个步骤
- **TemplateManager**: 模板管理服务
- **GitProviderService**: Git 提供商服务（GitHub/GitLab）
- **FluxService**: Flux GitOps 服务
- **EnvironmentsService**: 环境管理服务
- **RepositoriesService**: 仓库管理服务
- **InitializationStatus**: 项目初始化状态
- **OAuth Token**: OAuth 访问令牌
- **Repository Mode**: 仓库模式，包括 "existing"（关联现有）和 "create"（创建新仓库）

## 需求

### 需求 1: 前端流程审查

**用户故事**: 作为开发者，我希望前端项目创建流程清晰、健壮，能够正确处理各种边界情况

#### 验收标准

1. WHEN 用户填写项目基本信息时，THE ProjectWizard SHALL 验证所有必填字段的有效性
2. WHEN 用户选择模板时，THE ProjectWizard SHALL 正确传递模板配置到后端
3. WHEN 用户配置仓库时，THE ProjectWizard SHALL 区分"关联现有仓库"和"创建新仓库"两种模式
4. WHEN 用户使用 OAuth 令牌时，THE ProjectWizard SHALL 正确传递 `__USE_OAUTH__` 标识
5. WHEN 项目创建失败时，THE ProjectWizard SHALL 显示清晰的错误信息并允许用户重试

### 需求 2: 后端流程审查

**用户故事**: 作为系统管理员，我希望后端项目创建流程能够正确处理所有步骤，并在失败时进行适当的回滚

#### 验收标准

1. WHEN 接收到创建项目请求时，THE ProjectOrchestrator SHALL 验证用户权限
2. WHEN 创建项目时，THE ProjectOrchestrator SHALL 按正确顺序执行初始化步骤
3. WHEN 使用模板创建项目时，THE ProjectOrchestrator SHALL 正确应用模板配置
4. WHEN 创建新仓库时，THE ProjectOrchestrator SHALL 调用正确的 Git Provider API
5. WHEN 任何步骤失败时，THE ProjectOrchestrator SHALL 回滚已创建的资源

### 需求 3: OAuth 令牌处理审查

**用户故事**: 作为用户，我希望系统能够安全地处理我的 OAuth 令牌，并在令牌无效时给出明确提示

#### 验收标准

1. WHEN 用户选择使用 OAuth 令牌时，THE System SHALL 从数据库获取有效的令牌
2. WHEN OAuth 令牌不存在时，THE System SHALL 返回清晰的错误信息
3. WHEN OAuth 令牌过期时，THE System SHALL 提示用户重新授权
4. WHEN 使用手动输入的令牌时，THE System SHALL 验证令牌的有效性
5. WHEN 令牌验证失败时，THE System SHALL 不泄露敏感信息

### 需求 4: 仓库创建流程审查

**用户故事**: 作为用户，我希望系统能够正确创建或关联 Git 仓库，并处理各种异常情况

#### 验收标准

1. WHEN 创建新仓库时，THE System SHALL 调用正确的 Git Provider API
2. WHEN 关联现有仓库时，THE System SHALL 验证仓库 URL 的有效性
3. WHEN 仓库创建失败时，THE System SHALL 返回详细的错误信息
4. WHEN 推送初始代码时，THE System SHALL 处理推送失败的情况
5. WHEN 仓库已存在时，THE System SHALL 避免重复创建

### 需求 5: 初始化状态跟踪审查

**用户故事**: 作为用户，我希望能够实时看到项目初始化的进度，并在失败时了解具体原因

#### 验收标准

1. WHEN 项目初始化开始时，THE System SHALL 设置初始化状态为 "initializing"
2. WHEN 每个步骤完成时，THE System SHALL 更新初始化进度
3. WHEN 初始化失败时，THE System SHALL 记录失败原因和失败步骤
4. WHEN 用户查询项目状态时，THE System SHALL 返回当前初始化状态
5. WHEN 初始化完成时，THE System SHALL 将项目状态设置为 "active"


