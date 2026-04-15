# 2026-04-15 Environment Model And Git Routing Design

## 结论

Juanie 现在的 `environment` 表已经比 UI 和主流程更泛化，但实际发布链路仍然建立在一个更窄的产品假设上：

- 1 个长期非生产环境
- 1 个生产环境
- N 个 preview 环境

这导致三个问题：

1. 数据模型看起来支持 `dev / test / staging / prod`，但产品入口和编排逻辑并没有真正支持多个长期环境
2. Git 分支、环境类型、promotion 目标三种语义混在一起，用户很难理解“某个 ref 为什么会进某个环境”
3. 部分实现仍然把 `staging` 当作“唯一长期非生产环境”来写，阻止平台演进成真正的多环境交付控制面

这次设计要把环境模型收敛成一个现代化、可解释、可扩展的控制面：

- `Environment` 只表示“运行目标”
- `DeliveryRule` 只表示“什么 Git 事件会进入什么环境”
- `PromotionFlow` 只表示“环境之间如何流转”
- Preview 继续是 environment 的一种，不单独造第二套资源模型

目标状态不是“再加一个新建测试环境按钮”，而是把环境、Git、promotion 从当前半耦合状态拆开，形成统一主链路。

## 当前状态

### 已有能力

当前 `environment` 数据模型已经支持：

- `name`
- `branch`
- `tagPattern`
- `isPreview`
- `previewPrNumber`
- `expiresAt`
- `baseEnvironmentId`
- `databaseStrategy`
- `autoDeploy`
- `isProduction`
- `deploymentStrategy`
- `namespace`

因此，底层模型并不只支持 preview。

当前发布解析也已经有一个三段式优先级：

1. 先解析 preview ref
2. 再按 tag pattern 匹配
3. 最后按 branch 精确匹配

项目创建时会自动生成：

- `staging`
- `production`

当前环境页面则只显式提供：

- 新建 preview environment
- 清理 preview environment
- 调整 environment deployment strategy

### 当前约束

虽然表结构更泛化，但主流程并没有真正支持“多个长期环境”。当前隐含假设包括：

1. promotion 源环境默认就是“唯一 `autoDeploy=true && !isProduction` 的环境”
2. 非生产长期环境 namespace 默认共用 `juanie-{slug}`
3. preview 的继承基座默认选择“那个主要非生产环境”
4. 建项目时数据库、域名、初始基座都围绕单个 staging 初始化

这些约束意味着：

- 现在不能把“表里能建 test”误认为“产品真正支持 test”
- 当前属于“preview-first + single-persistent-env”架构，而不是“通用多环境平台”

## 目标

### 功能目标

Juanie 应同时支持两类环境：

1. 长期环境 `persistent`
   典型包括：`dev`、`test`、`staging`、`preprod`、`production`
2. 临时环境 `preview`
   典型包括：PR 预览、分支预览、短期验证环境

并支持三类交付来源：

1. Git 事件路由
   例如：`main -> staging`、`release/* -> preprod`
2. Preview 派生
   例如：PR 打开后生成 `preview-pr-42`
3. Promotion
   例如：`staging -> production`

### 非功能目标

1. 用户必须能一眼看懂某个环境是如何接收变更的
2. Git 分支模型不能和环境模型一一绑定
3. 生产环境默认不直接接受普通 branch 自动部署
4. namespace、数据库、域名、env vars 继承必须对多环境成立
5. GitHub 与 GitLab 必须共用同一套交付语义
6. 不引入第二套 preview 资源模型，不重复造轮子

## 核心设计

### 1. Environment 只表示运行目标

保留 `environment` 作为唯一环境实体，但把语义收敛成三种类型：

- `production`
- `persistent`
- `preview`

建议新增显式字段：

- `kind: 'production' | 'persistent' | 'preview'`

并逐步淘汰当前容易造成组合歧义的布尔表达：

- `isPreview`
- `isProduction`

最终判定规则应完全由 `kind` 决定，而不是依赖多个布尔组合。

保留以下字段：

- `name`
- `namespace`
- `deploymentStrategy`
- `databaseStrategy`
- `baseEnvironmentId`
- `expiresAt`
- `previewPrNumber`

删除“环境自己声明 Git 来源”的强绑定思路，逐步把以下字段从 environment 里迁出：

- `branch`
- `tagPattern`
- `autoDeploy`

这些不属于环境本身，而属于交付路由规则。

### 2. DeliveryRule 表示 Git 事件如何路由到环境

新增 `deliveryRules`，作为环境接收变更的唯一声明式入口。

建议字段：

- `id`
- `projectId`
- `environmentId`
- `kind: 'branch' | 'tag' | 'pull_request' | 'manual'`
- `pattern`
- `isActive`
- `priority`
- `autoCreateEnvironment`
- `createdAt`
- `updatedAt`

规则示例：

- `branch main -> staging`
- `branch develop -> dev`
- `branch test -> test`
- `tag v* -> preprod`
- `pull_request * -> preview template`
- `manual -> production`

解析顺序：

1. `pull_request`
2. `branch`
3. `tag`
4. `manual`

这样处理后：

- 环境不再背负“自己从哪个分支来”的职责
- GitHub / GitLab webhook 都只需归一为 `SourceEvent`
- UI 可以直接展示“路由规则”，而不是让用户猜 `branch`、`autoDeploy`、`isProduction` 组合语义

### 3. PromotionFlow 表示环境之间的流转图

生产环境不应被建模为“另一个吃 branch 的环境”，而应优先被建模为“promotion target”。

建议新增 `promotionFlows`：

- `id`
- `projectId`
- `sourceEnvironmentId`
- `targetEnvironmentId`
- `requiresApproval`
- `strategy: 'reuse_release_artifacts' | 'rebuild_from_ref'`
- `isActive`

默认推荐策略：

- `staging -> production`
- `requiresApproval = true`
- `strategy = reuse_release_artifacts`

原因：

1. 生产交付的本质是受控推广，不是继续跟某个分支自动漂移
2. promotion 让审批、冻结、回滚、变更窗口语义更自然
3. 产物重用能保证 staging 验证过的镜像进入 production，而不是同 commit 再构建一次造成漂移

长期环境之间也可以存在额外 promotion：

- `dev -> test`
- `test -> staging`
- `staging -> production`

但默认不强制所有项目都完整采用四段链路。

### 4. Preview 继续是 environment 特化，而不是第二套模型

保留此前 ADR 方向：preview 仍然是 environment 的一种。

但 preview 的创建来源不再散落在多个 if/else 中，而是统一走：

- `DeliveryRule(kind='pull_request')`
- 预览环境模板
- Preview 派生服务

Preview 特有能力：

- 平台统一命名
- TTL 与自动回收
- 基于 `baseEnvironmentId` 的继承
- `databaseStrategy` 支持 `inherit` / `isolated_clone`
- 默认 `auto cleanup`

这意味着预览环境继续复用：

- release
- deployment
- migration
- domain
- env vars
- observability

不会出现第二套 preview deployment / preview database / preview release 模型。

## 推荐产品模型

### 默认项目模板

Juanie 默认创建项目时，应允许用户选择一套简洁模板，而不是写死 staging/prod：

1. `Preview + Production`
   适合极小团队
2. `Staging + Production + Preview`
   推荐默认模板
3. `Dev + Test + Staging + Production + Preview`
   适合成熟团队

推荐默认模板为：

- `staging` persistent
- `production` production
- `preview` rule template

默认路由：

- `branch main -> staging`
- `pull_request * -> preview`
- `promotion staging -> production`

这样既现代，也不会一开始就把小团队拖进过度建模。

### GitHub / GitLab 统一语义

Git provider 只负责产生标准化事件，不负责环境决策。

平台内部统一归一为：

- `sourceType: 'push' | 'tag' | 'pull_request' | 'manual'`
- `ref`
- `branch`
- `tag`
- `prNumber`
- `headSha`
- `baseBranch`
- `repository`

后续全部环境解析都只基于这个标准化 `SourceEvent`。

这样 GitHub 与 GitLab 只在采集层不同，在控制面语义上完全一致。

## 运行时规则

### Namespace

namespace 必须按 environment 唯一生成，不能再只按“生产/非生产”二分。

建议规则：

- `production` -> `juanie-{slug}-prod`
- `persistent staging` -> `juanie-{slug}-staging`
- `persistent test` -> `juanie-{slug}-test`
- `persistent dev` -> `juanie-{slug}-dev`
- `preview` -> `juanie-{slug}-preview-pr-42`

这样多长期环境不会撞 namespace。

### Database

数据库拓扑应按环境种类工作，而不是围绕 preview 单独特判。

建议语义：

- `direct`: 环境拥有自己的主数据库
- `inherit`: 环境继承上游环境数据库配置
- `isolated_clone`: 环境基于上游数据库生成隔离副本

适用范围：

- `persistent` 可以 `direct` 或 `inherit`
- `preview` 可以 `inherit` 或 `isolated_clone`
- `production` 默认 `direct`

### Env Vars / Domains

继承链统一依赖：

- `baseEnvironmentId`

规则：

1. environment variables 按 lineage 合并
2. domain 模板按 environment kind 渲染
3. preview 使用平台生成 hostname
4. persistent 支持自定义主域名与服务域名

## UI 信息架构

当前环境页面把 preview 治理、策略治理、数据库治理、活动流堆在一起，用户很难理解主链。

重构后建议拆成两个主入口：

1. `Environments`
   管长期环境与 promotion 图
2. `Previews`
   管临时环境与回收

`Environments` 页面展示：

- 环境卡片
- 每个环境的 kind
- namespace
- database topology
- 接收来源规则
- 下游 promotion 目标
- 当前最新 release / migration / rollout

`Previews` 页面展示：

- preview 列表
- 来源 PR/branch
- TTL
- database strategy
- cleanup 状态
- 最新 preview release

新增一个 `Routing` 视图，用图形化方式显示：

- `push main -> staging`
- `PR -> preview`
- `staging -> production`

这会比把所有逻辑塞在 environment 行项目里清晰得多。

## 迁移路径

### Phase 1: 语义收敛

目标：不改 UI 主入口，先把运行时模型收正。

1. 引入 `environment.kind`
2. 引入 `deliveryRules`
3. 引入 `promotionFlows`
4. 保留旧字段读能力，仅作为数据迁移来源
5. 发布解析改为：`SourceEvent -> DeliveryRule -> Environment`

### Phase 2: 基础设施收敛

1. namespace 生成改为 environment 唯一命名
2. preview 基座解析改为显式配置，不再依赖“第一个非生产环境”
3. promotion 源环境不再通过 `autoDeploy && !isProduction` 猜测
4. 数据库、域名、env vars 的 lineage 逻辑统一围绕 `baseEnvironmentId`

### Phase 3: 产品入口重构

1. 环境页拆成 `Environments` 与 `Previews`
2. 新增通用 persistent environment 创建入口
3. 新增 Routing 视图
4. 新建项目改为选择环境模板，而不是写死 staging/prod

### Phase 4: 删除旧概念

在迁移完成后删除：

- `environment.branch`
- `environment.tagPattern`
- `environment.autoDeploy`
- 任何基于 `isProduction + autoDeploy` 猜测环境角色的代码
- 非生产长期环境共用 namespace 的逻辑

## 需要删除的旧假设

下面这些实现不应继续存在：

1. “唯一 auto-deploy 非生产环境就是 staging”
2. “非生产长期环境共用一个 namespace”
3. “production 是某个 branch 的自然终点”
4. “preview 是额外流程，长期环境才是主流程”
5. “环境自身声明 Git 来源，而不是路由规则声明 Git 来源”

## 风险与取舍

### 方案为什么比继续堆字段更好

如果继续在 `environment` 上追加：

- `sourceType`
- `promotionSource`
- `acceptTags`
- `acceptPullRequests`
- `manualOnly`

最终只会得到更难解释的 if/else 组合。

把环境、Git 路由、promotion 拆开后：

- UI 更容易解释
- 后端编排更稳定
- GitHub 与 GitLab 更易统一
- 多长期环境不再需要隐式推断

### 为什么不单独做 preview 表

原因仍然成立：preview 不是一套平行发布系统，它只是短生命周期环境。

如果单独建 preview 表，会立即复制：

- release 解析
- deployment 绑定
- migration 归属
- env vars 继承
- observability 查询

这属于重复造轮子，不应引入。

## 成功标准

当以下条件都成立时，说明这次重构完成：

1. 用户可以显式创建 `test`、`staging`、`preprod` 等长期环境
2. 用户可以从 UI 一眼看到每个环境的来源规则与 promotion 关系
3. production 默认通过 promotion 接收变更，而不是普通 branch 自动流入
4. preview 与长期环境共用统一 release/deployment/migration 模型
5. GitHub 与 GitLab 事件进入统一 `SourceEvent` 解析链
6. 系统内不再存在“唯一长期非生产环境”的硬编码假设

## 最终建议

Juanie 的现代化正确方向不是“让 environment 表再多几个字段”，而是把交付控制面拆成三层：

- `Environment` 负责运行目标
- `DeliveryRule` 负责 Git 到环境的路由
- `PromotionFlow` 负责环境间流转

这套模型能覆盖：

- 小团队的 `preview + production`
- 常规团队的 `staging + production + preview`
- 成熟团队的 `dev + test + staging + production + preview`

同时不会为 preview 单独造第二套系统，也不会继续把 branch、environment、promotion 三种语义绑死在一起。
