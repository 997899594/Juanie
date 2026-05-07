# 技术路线：安全与治理

## 30 秒版本

Juanie 是发布控制平面，安全边界必须是主链路能力。核心包括团队集成绑定、作用域访问控制、Secret/TLS/RBAC 基线、
审计日志、trace、AI plugin scope 和生产写操作确认。

## 团队集成绑定

Juanie 不应该长期依赖 owner 个人身份执行团队级操作。当前设计通过 team integration binding 建模执行身份：

- 团队默认 binding 是控制面执行身份。
- 成员移除时检查是否持有默认 personal binding。
- 非默认 personal binding 可自动撤销。

这解决的是团队成员离职、权限漂移和审计归属问题。

## API 访问控制

API route 应通过统一 helper：

- `requireSession()`
- `getTeamAccessOrThrow()`
- `getProjectAccessOrThrow()`
- `getReleaseAccessOrThrow()`

不要在 route handler 里临时手写 membership 查询。统一 helper 能减少权限遗漏和错误状态码不一致。

## Secret / TLS / RBAC

| 能力 | 当前基线 |
| --- | --- |
| Secret | 支持 existingSecret、内置 Secret、ExternalSecret |
| TLS | 不默认注入 `NODE_TLS_REJECT_UNAUTHORIZED=0` |
| RBAC | `pods/exec` 默认关闭，需要显式开关 |
| External Secrets | 生产优先用已有 Secret 或 External Secrets Operator |

## AI 安全

AI 也需要治理：

- plugin 有 scope。
- tool 有权限级别。
- usage 记录 actor、team、project、environment、release。
- prompt/skill 有版本。
- 写操作走 task center 或确认。
- 输出失败要降级。

AI 不能成为绕过 RBAC 和审计的后门。

## 常见追问

**问：环境变量展示给用户是否安全？**

展示不是问题，关键是权限、脱敏、来源、继承关系和审计。用户要能理解实际环境拿到了什么变量，但敏感值不应该随便明文泄露。

**问：为什么 pods/exec 默认关闭？**

因为 exec 是高风险运维能力，可能绕过应用层审计。平台应默认关闭，需要时显式开启并审计。

**问：AI 能否读取 secret？**

默认不应该。AI 做 envvar risk 可以分析 key、来源、变更和风险模式，但不需要读取明文 secret。

## 代码入口

| 主题 | 文件 |
| --- | --- |
| Access helpers | `src/lib/api/access.ts` |
| Errors | `src/lib/api/errors.ts` |
| Team binding | `src/lib/integrations/service/team-binding-service.ts` |
| Offboarding | `src/lib/teams/offboarding-service.ts` |
| Helm secret/TLS/RBAC | `deploy/k8s/charts/juanie/templates/` |
| AI plugin scope | `src/lib/ai/runtime/plugin-scope.ts` |
