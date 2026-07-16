# 技术路线：Schema Safety

## 30 秒版本

Juanie 的 schema safety 不是替用户强行接管 ORM，而是在发布前用 Atlas 和平台上下文做 diff、风险识别、
门禁、解释和修复建议。控制面自己的 schema 迁移只走 Atlas；用户应用的实际迁移执行尊重 `juanie.yml`。

## 两类 schema

| 类型 | 真源 | 执行 |
| --- | --- | --- |
| Juanie 控制面 schema | `src/lib/db/schema.ts` + `atlas.hcl` + `migrations/` | Argo PreSync schema-runner 执行 Atlas |
| 用户应用 schema | 子应用 ORM / migration / `juanie.yml` | Juanie 做 diff/safety/repair，执行按配置 |

这个边界非常重要。不要把“平台用 Atlas”讲成“所有子应用必须用 Atlas 写迁移”。

## 用户应用为什么不能只相信迁移脚本

现实里常见问题：

- ORM 定义改了，但忘了生成 migration。
- migration 存在，但没有准确表达最终 schema。
- 数据库里已经有手动改动。
- destructive change 没有确认。
- preview 继承数据库时误跑迁移。

所以 Juanie 需要在发布前做 schema gate。

## 推荐讲法

> 子应用可以继续使用自己的 ORM 和迁移工具。Juanie 不要求用户维护两套模型。平台层用 Atlas 做 schema diff、
> safety classification 和 repair guidance；真正执行迁移时，仍然遵守 `juanie.yml` 里声明的工具、命令、
> working directory、phase、approval policy 和 lock strategy。

## AI 在 schema safety 中的角色

确定性规则负责“挡不挡”，AI 负责“讲明白和给下一步”：

- 解释 diff 代表什么。
- 判断风险影响面。
- 说明为什么 migration 不足。
- 建议生成或修改迁移。
- 给出 PR/MR 修复方向。

AI 不能直接把失败 gate 改成成功。

## 关键风险

| 风险 | 处理 |
| --- | --- |
| 缺失 migration | gate 阻断，提示生成迁移 |
| destructive change | 需要显式审批或人工确认 |
| preview 数据库继承 | 防止误迁移继承源数据库 |
| migration 非线性 | hash/status 校验，避免乱序 |
| runner 环境不完整 | schema-runner 镜像统一 runtime 基线 |

## 代码入口

| 主题 | 文件 |
| --- | --- |
| API 外部入口 | `src/lib/schema-safety/index.ts` |
| Release gate | `src/lib/releases/schema-gate.ts` |
| Inspect | `src/lib/schema-management/inspect.ts` |
| Atlas run | `src/lib/schema-management/atlas-run.ts` |
| Runner job | `src/lib/schema-management/schema-runner-job.ts` |
| Repair plan | `src/lib/schema-management/repair-plan.ts` |
| Realtime | `src/lib/schema-management/realtime.ts` |
| AI migration review | `src/lib/ai/plugins/migration-review/` |
