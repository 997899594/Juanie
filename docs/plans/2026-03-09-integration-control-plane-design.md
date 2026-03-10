# 2026-03-09 Integration Control Plane 重构设计（一次切换，零兼容）

## 背景与问题

当前项目存在多条 Git 授权与调用路径：

- 登录路径（`src/lib/auth.ts`）与 Git Provider 路径（`src/lib/git/github.ts`）的 scope 不一致。
- 业务链路（项目创建、仓库分析、初始化 worker）可直接读取 provider token，缺少统一能力校验。
- 权限不足时常表现为外部 provider 404，错误语义不清晰。

这导致：

- 同一用户在不同路径拿到的 token 能力不同。
- 初始化阶段出现迷惑性失败（例如写 workflow 文件失败）。
- 系统边界不清，难以长期演进。

## 目标

本次重构采用 **Control Plane First**，并执行：

- **一次性切换（One-shot）**
- **零历史兼容（No legacy compatibility）**
- **当前分支直接开发**

最终目标：

1. 单一授权源（Single Source of Truth）
2. 单一能力判定源（Capabilities）
3. 单一 Git 调用入口（Gateway）
4. 全链路可观测（trace + capability usage）
5. 明确错误语义（不再以 provider 404 直出）

## 目标架构

### 1. Integration Control Plane（核心）

新增统一领域层：

- `IntegrationIdentity`：授权主体（user/team/service account）
- `IntegrationGrant`：授权记录（provider、token、scope、状态、过期）
- `CapabilityResolver`：scope/API 权限 -> 平台 capability
- `IntegrationSession`：运行时最小权限会话（业务仅使用 session）
- `IntegrationGateway`：统一 Git 操作接口（repo/files/webhook）

### 2. 硬性边界

业务代码禁止：

- 直接读取 `gitProvider.accessToken`
- 直接实例化 provider client 并调用远端 API

业务代码必须：

- 通过 Control Plane 申请带能力约束的 session
- 声明每个动作的 required capabilities

## 组件与文件改造

### A. 新增目录

- `src/lib/integrations/domain/`
  - `models.ts`
  - `errors.ts`
  - `capability.ts`
- `src/lib/integrations/service/`
  - `integration-control-plane.ts`
  - `grant-service.ts`
  - `session-service.ts`
- `src/lib/integrations/adapters/`
  - `github-adapter.ts`
  - `gitlab-adapter.ts`

### B. 改造现有核心文件

1. `src/lib/auth.ts`
- 登录回调改为调用 `upsertGrantFromOAuth`
- signOut 改为 `revokeActiveGrants(userId)`
- 删除直接更新 `gitProvider` token 的路径

2. `src/lib/queue/project-init.ts`
- `getTeamGitProvider(...)` 替换为 `getTeamIntegrationSession(...)`
- 每个步骤声明 required capabilities
- 缺能力时返回结构化业务错误（如 `MISSING_CAPABILITY(write_workflow)`）

3. `src/app/api/git/repositories/route.ts`
4. `src/app/api/git/repositories/analyze/route.ts`
- 全部改为 Control Plane session 调用
- 移除 providerId 直连信任模式

5. `src/components/projects/create-project-form.tsx`
- 从“单 provider 选择”升级为“integration + capability 可视化选择”

### C. 数据层

新模型：

- `integration_identity`
- `integration_grant`
- `integration_capability_snapshot`（可选但建议）

旧 `gitProvider`：

- 在一次切换窗口后停止读写
- 稳定后删除表与关联路径

## 全链路数据流

### 登录/授权
1. OAuth 回调进入 auth。
2. auth 调用 Control Plane upsert grant。
3. Control Plane 读取 provider 实时权限并计算 capability。
4. 保存 grant + capability 快照。

### 创建项目
1. 前端获取可用 integrations（含 capability）。
2. 用户绑定 integrationId。
3. 项目只保存 integration 引用，不保存 provider token 信息。

### 初始化
1. worker 用 integrationId 请求运行时 session。
2. 步骤按 capability gate 执行：
   - validate_repository: `read_repo`
   - push_cicd_config: `write_repo` + `write_workflow`
   - setup_webhook: `manage_webhook`
3. 缺能力直接返回结构化错误。

## 错误模型

统一错误码：

- `INTEGRATION_NOT_BOUND`
- `GRANT_EXPIRED`
- `GRANT_REVOKED`
- `MISSING_CAPABILITY(<capability>)`
- `PROVIDER_ACCESS_DENIED`
- `PROVIDER_RESOURCE_NOT_FOUND`

错误要求：

- API/Worker 统一错误结构
- UI 给出可执行修复建议（例如重新授权 workflow scope）

## 测试策略

1. 单元测试
- capability 解析
- provider error -> domain error 映射

2. 集成测试
- OAuth 入库 grant
- 初始化能力门禁
- API 统一经 Control Plane

3. E2E
- 完整授权与初始化成功流程
- 缺能力失败流程（错误码可读）

4. 回归
- GitHub/GitLab
- import/create
- webhook 链路

## 发布策略（一次切换）

1. 维护窗口冻结写入
2. 执行 schema migration（新 integration 模型）
3. 部署新版本（所有路径切至 Control Plane）
4. 强制重新授权
5. 进行 smoke 检查（OAuth、初始化、错误码）
6. 删除旧路径与旧表

## 非目标

- 不做历史 token 兼容
- 不保留旧 providerId/token 直连逻辑
- 不做渐进双写/双读

## 验收标准

- 任一 Git 操作都无法绕过 Control Plane
- 初始化链路不再因缺 workflow scope 返回迷惑 404
- 权限问题都体现为结构化错误码
- 旧路径代码全部删除，运行时不再读旧 token 字段
