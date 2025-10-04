# Juanie 技术架构文档（TRD）

> 版本：MVP零成本策略（Single Source of Truth）
> 本文即为唯一技术架构文档。若发现他处有同类文档，请删除并回链至此。

## 1. 目标与范围

* 目标：在最短时间交付可运行的MVP，保持工具链零历史包袱、零重复配置。

* 范围：前端 Web、后端 API、设计系统 UI 与共享包。

* 原则：不为未来做过度设计；所有决定以“可运行、可维护”为第一优先。

## 2. 工具链与质量保障

* Lint：`oxlint`（根运行 `pnpm lint`）。

* Format：`@biomejs/biome`（根运行 `pnpm format` / `pnpm format:check`）。

* Test：`vitest`，按包维度维护。

* Build：`vite` + `turbo`（工作区构建、缓存与任务编排）。

* 组件与样式：Naive UI 组件优先；UnoCSS 仅用于辅助样式、主题令牌与少量布局原子类（`preset-uno`、`preset-attributify`、`preset-icons`），统一在 `packages/ui` 定义主题与预设。

* 包管理：`pnpm` + `workspace:*`，统一依赖来源与版本。

* 提交钩子：`husky + lint-staged` 执行 lint/format 检查；禁止绕过。

## 3. 目录与模块

* 应用：`apps/web`（Vue 3 + Vite）/ `apps/api`（Node/Nest）。

* 共享：`packages/shared`（类型、工具函数）、`packages/ui`（组件与主题）、`packages/devops-widgets`（运营组件）。

* 配置：`configs/*`（tsconfig/vite 等共用配置）。

* 文档：`.trae/documents/*`（TRD/PRD/设计），此目录为单一真源。

## 4. 规则与约束

* 零相对路径：跨包用 `workspace:*` 与别名，不写硬编码路径。

* 零硬编码：环境变量、配置项必须进 `.env` 或 `config.ts`，禁止写死。

* 零重复：通用逻辑抽到 `packages/shared`；样式抽到 `packages/ui`。

* 零警告：`oxlint` 报错阻断提交；`Biome` 统一格式。

* 零历史包袱：废弃工具与文件立即删除（ESLint/Stylelint/Prettier 已清理）。

* UI 优先级：先用 Naive UI 组件（如 `n-button`、`n-card`、`n-form`）；仅在组件未覆盖的细粒度布局或一次性视觉微调时使用 UnoCSS 原子类（如 `flex gap-2 px-4`）。示例：正例 `<n-button type="primary">提交</n-button>` + `class="ml-2"`；反例 `<button class="btn px-4 py-2">提交</button>` 自造基础按钮。

## 5. 密钥与配置（密钥检测）

* 禁止将任何真实密钥、令牌、证书提交到仓库。

* `.env` 仅用于本地开发，提交 `.env.example` 作为占位。

* CI/生产环境通过平台密钥管理（如 GitHub/Vercel/Supabase 的 secrets），不落盘。

* 如需自动检测，优先使用托管平台的内置 Secret Scanning；不引入额外依赖。

## 6. 开发流程（最小化）

* 本地：`pnpm install` → `pnpm dev`（按包）→ `pnpm lint` → `pnpm format:check`。

* 提交：`husky` 自动执行 `lint-staged`；失败阻断提交。

* CI：复用同一 `pnpm lint` 与 `pnpm format:check`，保持与本地一致。

## 7. 变更管理

* 任何架构决策必须更新本 TRD；禁止另起“零成本MVP版”等副本。

* 若需重大调整，直接在本文增量更新并标注版本与日期。

## 8. 现状校验（2025-10)

* Lint/Format 已统一到 `oxlint + Biome`；VS Code 默认格式化器为 `biomejs.biome`。

* `apps/web` 已恢复 UnoCSS 预设并安装依赖；`vite` 插件启用。

* 根脚本：`pnpm lint`、`pnpm format`、`pnpm format:check` 已通过校验。

## 9. MVP 1.5 AI 功能

* 说明：与 PRD 完全对齐，复用 PRD 的用户故事与验收标准；本章仅给出技术实现要点、对接点、零成本论证与接口定义，确保双文档 Single Source of Truth。

### 9.1 构建失败智能摘要

* 技术实现要点：本地 `CodeLlama-7B` 通过 `llama.cpp`/`node-llama-cpp` 在 CPU 推理；输入为 CI 构建日志，输出为中文摘要、可能原因与推荐操作。

* 与现有架构对接：

  * `packages/shared`: 提供 `generateFailureSummary(logs, options)`（已存在占位实现）。

  * `apps/api`: 暴露 HTTP API，封装本地模型推理与日志解析。

  * `@juanie/web`: 在构建页面/CI 面板展示摘要与一键修复建议。

* 零成本论证：模型本地运行、纯 CPU 推理；不依赖付费 API；日志来源为 CI 原生输出；无外部存储与第三方服务费用。

* 接口定义：

  * URL：`POST /api/ai/build-summary`

  * Method：`POST`

  * Request Schema：

    ```json
    {
      "riskLevel": "low|medium|high",
      "predictedCost": 0,
      "thresholdCrossings": [{ "at": "string", "metric": "string", "value": 0 }],
      "message": "string"
    }
    ```

  * Response Schema：

    ```json
    {
      "metrics": [{ "timestamp": "string", "value": 0 }],
      "horizonHours": 24,
      "budget": 100
    }
    ```

### 9.2 一键环境快照

* 技术实现要点：集成 `helm` + `kubectl` 打包当前集群资源（不含敏感数据），产物上传至 `GitHub Release`，并返回下载 URL。

* 与现有架构对接：

  * `packages/devops-widgets`: 提供触发与进度 UI 组件。

  * `apps/api`: 调用本地 `kubectl`/`helm`，打包为 `tar.gz` 并上传到仓库 Release。

  * `@juanie/web`: 在运维面板提供“一键快照”入口与下载链接。

* 零成本论证：使用已有 CLI 工具与 GitHub 仓库免费 Release 存储；不引入额外云存储。

* 接口定义：

  * URL：`POST /api/ai/env-snapshot`

  * Method：`POST`

  * Request Schema：

    ```json
    {
      "snapshotUrl": "string",
      "artifacts": [{ "path": "string", "type": "helm|kubectl" }],
      "size": 0
    }
    ```

  * Response Schema：

    ```json
    {
      "clusterContext": "string",
      "namespaces": ["string"],
      "includeSecrets": false
    }
    ```

### 9.3 成本预警

* 技术实现要点：使用 `Prometheus` 指标作为时间序列，调用 `packages/shared` 中的 `predictCost(metrics, options)`（已占位），采用 `llama3-gradient`/线性外推形成 24–72 小时成本趋势，按阈值触发 Webhook 通知。

* 与现有架构对接：

  * `packages/shared`: 定义 `MetricPoint`、`PredictionResult` 类型与预测函数。

  * `apps/api`: 拉取 Prometheus 指标、执行预测与阈值判断。

  * `@juanie/web`: 在仪表盘显示风险等级与预计成本。

* 零成本论证：Prometheus 指标为自建/平台内置；预测逻辑与模型本地运行；通知走自有 Webhook/邮件，无第三方计费。

* 接口定义：

  * URL：`POST /api/ai/cost-warning`

  * Method：`POST`

  * Request Schema：

    ```json
    {
      "summary": "string",
      "causes": ["string"],
      "recommendedActions": ["string"],
      "confidence": 0.0
    }
    ```

  * Response Schema：

    ```json
    {
      "metrics": [{ "timestamp": "string", "value": 0 }],
      "horizonHours": 24,
      "budget": 100
    }
    ```

## 10. 第二阶段升级路径

* 架构治理：引入 Changesets 自动发版流；`turbo` 编排 CI 任务缓存。

* API 规范：采用 OpenAPI（或 tRPC）生成类型，统一后端契约。

* 观测性：接入 OpenTelemetry + 平台日志/指标；关键路径打点。

* 安全与密钥：统一 OIDC/SSO；Secrets 全托管；增加泄露扫描策略。

* 交付质量：增加 Playwright E2E；Vitest 覆盖率门槛 80%。

* 性能策略：前端按路由分包、资源懒加载；后端缓存与限流策略固化。

* 基础设施：本地 Docker Compose；生产预留 K8s（不做过度设计）。

* 数据管理：Prisma 迁移规则与回滚策略；约束与索引标准化。

### 零成本 MVP 技术栈优先级

* 说明：MVP 阶段只落地 Must 清单；Should/Optional 留待第二阶段按反馈逐步迭代。

* Must（必须）：覆盖交付、运行、观测、密钥与前端构建的最小闭环。

  * `GitHub Free + GitLab CI/CD`

  * `K3s + Rancher`

  * `Grafana + Prometheus + Loki`

  * `Vite + Turborepo`

  * `External Secrets Operator + Vault Community Edition`

  * `Argo CD + Kustomize`

* Should（建议）：增强 IaC、安全左移与开发者体验，降低长期运维成本。

  * `Terraform` 或 `Pulumi`（二选一即可）

  * `Trivy + Semgrep + Gitleaks`

  * `Uptime Kuma`

  * `Backstage`

* Optional（可选）：成本优化与冗余安全扫描，视云厂商免费额度与团队能力启用。

  * `OpenCost`（云厂商免费额度）

  * `OWASP Dependency-Check`（与 Semgrep 部分重叠）

> 执行闭环：请参见 `docs/roadmap.md` 获取每项的验收标准、负责人与截止时间。

## 11. 混合构建策略（前沿实践）

### 11.1 包内 Rolldown + 应用层 Vite

* **UI 包**（packages/ui）采用 Rolldown 0.x 构建：

  * 多入口输出子路径（theme、naive-ui、tokens…）

  * 产物路径与 package.json exports 严格对齐，如 dist/src/theme.js

  * 构建耗时 <1 s，提前验证 Rolldown 稳定性

* **应用层**（apps/web、apps/api）继续 Vite：

  * 生态插件（Vue SFC、HMR、SSR）100 % 兼容

  * 待 Vite 6 官方默认切换 Rolldown 后可零配置迁移

* 备注：`packages/devops-widgets` 当前已暂时删除；恢复后沿用 Vite 或再评估 Rolldown

### 11.2 pnpm catalog 锁定依赖

* 在 pnpm-workspace.yaml 声明 catalog 版本，例如：

  ```yaml
  {
    "riskLevel": "low|medium|high",
    "predictedCost": 0,
    "thresholdCrossings": [{ "at": "string", "metric": "string", "value": 0 }],
    "message": "string"
  }
  ```

* 各包引用时使用 "catalog:vue"，确保全仓库版本单一来源， Renovate 自动 PR 升级

### 11.3 图标类规范

* 全仓库统一使用 "icon-" 前缀，如 icon-lucide-home

* UnoCSS preset-icons 已配置 prefix: 'icon-'，避免误匹配普通类名

* 旧类名（i-xxx / i="-") 已全局清理，后续 CI 检测到非 icon- 前缀即报错

***

本文即为唯一技术架构文档。若发现他处有同类文档，请删除并回链至此。

***

