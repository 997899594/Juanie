# 项目创建流程修复 - 需求文档

## 简介

修复项目创建流程中的职责混乱、边界不清和数据一致性问题,确保创建过程的原子性和可靠性。

## 术语表

- **ProjectsService**: 项目服务,负责项目的CRUD操作和权限检查
- **ProjectOrchestrator**: 项目编排器,负责协调项目初始化流程
- **StateHandler**: 状态处理器,处理初始化流程中的特定步骤
- **FinalizeHandler**: 完成处理器,负责初始化流程的最后步骤
- **InitializationContext**: 初始化上下文,包含初始化过程中的所有数据

## 需求

### 需求 1: 职责分离

**用户故事**: 作为开发者,我希望ProjectsService和Orchestrator职责清晰,以便代码易于维护和测试

#### 验收标准

1. WHEN 项目创建流程执行时 THEN ProjectsService SHALL 只负责权限检查和调用orchestrator
2. WHEN 项目初始化完成时 THEN Orchestrator SHALL 返回完整的项目对象而不需要额外查询
3. WHEN 项目成员需要添加时 THEN 成员添加 SHALL 在FinalizeHandler内完成
4. WHEN 审计日志需要记录时 THEN 审计日志 SHALL 在FinalizeHandler内记录
5. WHEN 初始化失败时 THEN 系统 SHALL 不会留下孤儿数据

### 需求 2: 原子性保证

**用户故事**: 作为系统管理员,我希望项目创建是原子操作,以便失败时不会产生不一致的数据

#### 验收标准

1. WHEN 项目初始化开始时 THEN 所有数据库操作 SHALL 在同一个事务中执行
2. WHEN 任何步骤失败时 THEN 系统 SHALL 回滚所有已执行的操作
3. WHEN 项目创建完成时 THEN 项目记录、成员记录和审计日志 SHALL 同时存在或同时不存在
4. WHEN 并发创建相同项目时 THEN 系统 SHALL 只允许一个成功

### 需求 3: 环境创建智能化

**用户故事**: 作为用户,我希望系统智能处理环境创建,避免重复创建模板已定义的环境

#### 验收标准

1. WHEN 使用模板创建项目时 THEN 系统 SHALL 检查模板是否已定义环境
2. WHEN 模板已定义环境时 THEN 系统 SHALL 不创建默认环境
3. WHEN 模板未定义环境时 THEN 系统 SHALL 创建默认环境(development, staging, production)
4. WHEN 环境创建完成时 THEN 所有环境 SHALL 正确关联到项目

### 需求 4: 状态机与队列边界清晰

**用户故事**: 作为开发者,我希望状态机和队列的职责边界清晰,以便理解和维护代码

#### 验收标准

1. WHEN 操作可以同步完成时 THEN 操作 SHALL 在状态机中执行
2. WHEN 操作需要长时间运行时 THEN 操作 SHALL 通过队列异步执行
3. WHEN 仓库创建请求时 THEN 请求 SHALL 通过队列处理
4. WHEN GitOps设置请求时 THEN 请求 SHALL 通过事件发布
5. WHEN 状态机完成时 THEN 项目状态 SHALL 正确反映是否有异步任务pending

### 需求 5: GitOps设置反馈机制

**用户故事**: 作为用户,我希望知道GitOps资源是否真正创建成功,而不仅仅是请求已发送

#### 验收标准

1. WHEN GitOps设置请求发送时 THEN 系统 SHALL 记录请求状态
2. WHEN GitOps资源创建完成时 THEN 系统 SHALL 更新项目状态
3. WHEN GitOps资源创建失败时 THEN 系统 SHALL 记录错误信息并通知用户
4. WHEN 查询项目状态时 THEN 系统 SHALL 返回GitOps资源的实际状态
5. WHEN GitOps设置超时时 THEN 系统 SHALL 标记为失败并允许重试

### 需求 6: 返回值优化

**用户故事**: 作为API调用者,我希望创建项目后直接获得完整的项目信息,而不需要额外查询

#### 验收标准

1. WHEN 项目创建成功时 THEN Orchestrator SHALL 返回完整的项目对象
2. WHEN 项目创建成功时 THEN 返回对象 SHALL 包含项目ID、名称、状态等所有基本信息
3. WHEN 有异步任务时 THEN 返回对象 SHALL 包含jobIds数组
4. WHEN ProjectsService.create()返回时 THEN 不需要额外的数据库查询
5. WHEN 初始化失败时 THEN 返回对象 SHALL 包含详细的错误信息

### 需求 7: 错误处理增强

**用户故事**: 作为开发者,我希望错误处理清晰明确,以便快速定位和修复问题

#### 验收标准

1. WHEN 任何步骤失败时 THEN 系统 SHALL 抛出具体的错误类型
2. WHEN 错误发生时 THEN 错误信息 SHALL 包含失败的步骤和原因
3. WHEN 数据库操作失败时 THEN 系统 SHALL 记录详细的错误日志
4. WHEN 外部服务调用失败时 THEN 系统 SHALL 区分临时错误和永久错误
5. WHEN 错误可重试时 THEN 系统 SHALL 提供重试机制
