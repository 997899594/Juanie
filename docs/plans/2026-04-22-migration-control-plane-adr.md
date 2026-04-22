# ADR: Migration Truth And Schema Control Plane Boundary

## Status
Accepted

## Context

Juanie 现在同时承担两类数据库职责：

1. 子应用发布主链上的迁移执行。
2. 环境 inspect、repair、adopt、drift diff 等平台治理动作。

这两类能力在实现上已经部分分离，但产品语义和代码信号还不够统一：

- `juanie.yaml` 已支持 `schema.source=atlas|drizzle|prisma|knex|typeorm|sql|custom`，说明子应用 schema 真相本来就是多态的。
- 发布执行器目前按工具分发，`drizzle`、`atlas`、`sql` 走不同主链，而不是所有项目都先转成 Atlas 再发版。
- schema repair / review request 这条治理链已经倾向统一使用 Atlas 作为 diff / scaffold / adopt / repair 引擎。

如果继续把“Atlas 是平台治理层”与“Atlas 是所有子应用唯一迁移格式”混在一起，会出现两个问题：

- 子应用为了接 Juanie 被迫维护第二套 schema authoring / migration 文件。
- 平台代码和提示文案会暗示 Atlas 才是唯一正确答案，削弱 repo-tracked migration truth 的边界。

## Decision

Juanie 采用双层模型：

1. 子应用自己的 repo-tracked schema source 是发布真相层。
   - 子应用可以使用 `atlas`、`drizzle`、`sql`，以及未来通过 adapter 纳入托管的其他 source。
   - 平台发布时优先执行仓库里已跟踪、可审计、可复现的迁移真相，不执行任意脚本推断出的临时迁移。

2. Atlas 是 Juanie 的统一 schema control plane。
   - Atlas 用于 diff、repair、adopt、baseline、drift 检测、review scaffold、治理态检查。
   - 这不等于要求所有子应用都把发布主链改成 `schema.source=atlas`。

3. 平台必须在代码与文案中明确区分三个概念：
   - `schema.source`: 子应用声明的 schema 真相层。
   - `execution tool`: 发布阶段真正执行的工具适配器。
   - `schema control plane`: 平台用于治理和修复的统一能力层，当前为 Atlas。

4. 对于当前暂不支持平台托管执行的 source：
   - 应明确要求配置为 `external`，而不是暗示“把所有项目改成 Atlas”。
   - 未来如果要支持 `prisma`、`knex`、`typeorm`，应通过 adapter 纳入 repo-tracked truth，而不是在发布时动态转译。

## Consequences

### Positive

- 子应用只维护一套真正参与发布的 schema truth，避免双路径。
- 平台仍能统一提供 drift、repair、adopt、inspect 等治理能力。
- 代码里的支持矩阵、错误提示、默认注释会更准确地表达架构边界。
- 后续扩展 Prisma/Knex/TypeORM 时有清晰落点：补 adapter，而不是重写控制面原则。

### Negative

- 平台短期内仍需要维护工具适配层，而不是只有一个“Atlas all the way”执行器。
- 某些 source 在完全纳入托管前，仍需保留 `external` 模式。

### Neutral

- Atlas 仍然是控制面迁移和 schema repair 的核心引擎，这部分不会因为子应用多态而改变。
- MySQL 上的 `drizzle` 当前可以通过平台 SQL 执行适配器进入托管发布，但它的治理层仍由 Atlas 统一承接。

## Alternatives Considered

### Alternative A: Atlas 作为所有子应用唯一迁移格式

Rejected.

原因：

- 子应用需要额外维护第二套 schema/migration 真相。
- 数据迁移、手写 SQL、扩展能力安装等意图容易在运行时转译中失真。
- 会让 Juanie 过多承担对子应用内部 ORM 结构的翻译责任。

### Alternative B: 完全按各 ORM 自治，平台不统一治理

Rejected.

原因：

- drift、adopt、repair、inspect、review scaffold 会碎片化。
- 平台很难给出统一的环境级 schema 状态和恢复路径。

## References

- [Environment Schema Management Implementation](./2026-04-10-environment-schema-management-implementation.md)
- [Platform Modernization Buy Vs Build Design](./2026-04-20-platform-modernization-buy-vs-build-design.md)
- [schema-source.ts](/Users/findbiao/projects/Juanie/src/lib/migrations/schema-source.ts)
- [runner.ts](/Users/findbiao/projects/Juanie/src/lib/migrations/runner.ts)
- [review-request-helpers.ts](/Users/findbiao/projects/Juanie/src/lib/schema-management/review-request-helpers.ts)
