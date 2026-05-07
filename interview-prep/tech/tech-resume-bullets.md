# 技术简历表达

## 版本 1：架构

- 设计并实现 AI 原生 release control plane，基于 Next.js、PostgreSQL、BullMQ、Kubernetes、Argo CD、
  Argo Rollouts、Atlas 和 Redis-backed SSE 构建项目创建、preview、staging、production rollout 全链路。
- 将平台自身发布与用户应用发布解耦：平台自身通过 GitHub Actions 更新 GitOps 指针并由 Argo CD/Helm 同步，
  用户应用通过 release state machine 执行 schema gate、migration、deployment、verification 和 rollout。

## 版本 2：数据库与发布安全

- 建立 schema safety 主链，使用 Atlas 进行 diff/safety/repair 和控制面迁移执行，结合子应用
  `juanie.yaml` 迁移配置实现发布前数据库风险门禁。
- 将 production 发布建模为可审计状态机，支持 staging promotion、候选版本追踪、受控放量和 release detail 操作闭环。

## 版本 3：AI 工程化

- 构建 AI plugin runtime，支持 provider adapter、markdown prompt/skill assets、plugin manifest、scope/permission、
  structured output、eval fixtures 和 usage audit。
- 实现 environment summary、release intelligence、incident intelligence、migration review、envvar risk 等内建 AI 能力，
  将模型输出接入 release/environment 页面和 task center。

## 版本 4：可观测性与治理

- 设计 Redis-backed SSE 实时事件链路，覆盖项目初始化、release、deployment、schema repair 和删除清理进度。
- 推动团队 integration binding、Secret/TLS/RBAC baseline、audit log 和 W3C trace context，提升发布控制平面的生产治理能力。
