# Preview Environments ADR

## 决策

Juanie 将 Preview Environment 设计为 **Environment 的一类特化实例**，而不是新的平行资源。

这意味着：

- 预览环境继续使用 `environment` 作为一等对象
- release、deployment、migration、domain、env vars 继续绑定到同一个 environment 模型
- 不创建第二套“临时环境表”或“预览部署表”

## 原因

Juanie 的发布主链已经是：

`release -> migration -> deployment`

而 release 本身天然依赖 environment。如果再引入一套独立 preview 模型，后面会出现：

- release 解析两套环境来源
- migration 需要区分正式环境和预览环境逻辑
- domain / namespace / env vars 再做一层映射

这会让架构碎裂。

## 模型

Preview Environment 使用现有 environment 表，并增加预览生命周期字段：

- `isPreview`
- `previewPrNumber`
- `branch`
- `expiresAt`

约束：

- `isPreview=true` 的环境不允许 `isProduction=true`
- preview 环境默认 `autoDeploy=true`
- preview 环境名称由平台统一生成，不接受自由命名

## 命名规则

- PR 预览：`preview-pr-123`
- 分支预览：`preview-feature-xyz`

namespace 也按此衍生，保持可预测与可清理。

## 生命周期

### 创建

通过平台 API 显式创建或更新：

- 输入：`branch` 或 `prNumber`
- 输出：preview environment 记录

### 解析

release 在解析目标环境时：

1. 优先匹配 preview PR
2. 再匹配 preview branch
3. 再走 staging / production 的常规分支与 tag 规则

### 过期

preview 环境有 TTL，由 `expiresAt` 表示。

当前阶段先做：

- 数据模型
- 创建 API
- release 解析

后续再补：

- 自动回收 worker
- UI
- 预览域名
- 临时数据库策略

## 为什么不先做 UI

预览环境如果没有统一模型，先做 UI 只会制造第二套入口。  
Juanie 应该先把 preview environment 变成发布控制平面的一部分，再决定如何展示。
