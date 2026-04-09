# Authz 与团队集成加固实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 消除路由层重复的鉴权代码，补上 project/team 作用域逃逸问题，并把 Git 执行身份从 `owner` 的个人授权切换为团队绑定的集成身份，使员工离职后系统仍可正常运行。

**架构：** 新增一层轻量的 `src/lib/api` 访问收口层，统一处理 session、team、project、environment、service 的解析；角色与动作规则统一收口到纯函数 `src/lib/policies`；新增 `teamIntegrationBindings` 作为团队级绑定层，承接现有 `integration_identity` 与 `integration_grant`。整体分两段上线：第一段先做 authz 加固，不引入 schema 风险；第二段引入团队绑定、完成回填，并移除 owner fallback。

**技术栈：** Next.js App Router、NextAuth、Drizzle ORM/PostgreSQL、Bun test runtime、BullMQ worker、TypeScript。

---

## 范围

这份计划覆盖本次审查里暴露出的几个核心问题：

- API 路由里大量重复的 `auth() + teamMembers.findFirst()` 逻辑
- 多个 K8s 路由缺少 `environmentId` / `serviceId` 归属校验
- Pod exec、Secret/ConfigMap 修改等高风险动作权限边界不一致
- Git 仓库 API 仅依赖外部传入 `teamId`，没有验证当前操作者是否属于该团队
- `getTeamIntegrationSession()` 当前依赖团队 owner 的个人身份，而不是团队绑定身份
- 团队依赖员工 OAuth grant，导致离职时存在连带中断风险
- 认证相关文档与实际实现漂移，`src/proxy.ts` 也有无效残留逻辑

## 关键决策

### 1. 执行身份归团队，审计身份归用户

- Git / K8s 自动化执行使用团队绑定的集成身份。
- 审批、手动触发、审计日志、UI 里的“谁操作的”仍然保留真实用户身份。
- 审计记录里需要同时保留：
  - `actingUserId`
  - `teamIntegrationBindingId` 或 `grantId`

### 2. 用团队绑定，不再直接回退到 owner 身份

不删除现有 `integration_identity` / `integration_grant`，而是在上层新增团队绑定表：

- 用户级 OAuth 登录仍然负责产生 identity 和 grant
- 团队显式绑定一个 identity 作为默认执行身份
- 生产推荐路径是绑定 bot / service account
- 兼容期可以把当前 owner 的 identity 回填成默认绑定，但这是过渡方案

### 3. 动作权限显式化

目标权限规则如下：

- team / project 只读：任意 team member
- deploy / promote / remediation：
  - 生产环境：`owner` 或 `admin`
  - 非生产环境：`owner`、`admin`、`member`
- pod exec：仅 `owner` 或 `admin`
- Secret / ConfigMap 创建删除：仅 `owner` 或 `admin`
- 团队重命名、删除、成员角色调整：仅 `owner`
- 邀请创建与撤销：`owner` 或 `admin`

### 4. 所有资源边界都做归属校验

任何接收 `projectId`、`environmentId`、`serviceId`、`releaseId`、`teamId` 的路由，都必须先验证子资源确实属于父资源，再去访问 K8s 或外部 Provider。

## 上线顺序

1. 先上线策略层和访问收口层。
2. 先修高风险 K8s 路由和 Git 路由。
3. 再加团队集成绑定表，并在兼容模式下回填现有团队。
4. 然后把 Git API、项目初始化、promote、worker 全部切到团队绑定。
5. 补团队集成管理 UI 和离职保护。
6. 最后移除 owner fallback、清理无效 proxy、对齐文档，并把测试命令纳入标准校验。

---

### 任务 1：定义统一的授权动作矩阵

**文件：**
- Create: `src/lib/policies/runtime-access.ts`
- Test: `src/lib/policies/__tests__/runtime-access.test.ts`
- Modify: `src/lib/policies/delivery.ts`

**步骤 1：先写失败测试**

```ts
import { describe, expect, it } from 'bun:test';
import {
  canExecInEnvironment,
  canManageConfigObjects,
  canReadProjectRuntime,
} from '@/lib/policies/runtime-access';

describe('runtime access policy', () => {
  it('allows members to read runtime state', () => {
    expect(canReadProjectRuntime('member')).toBe(true);
  });

  it('blocks members from exec in production and non-production by default', () => {
    expect(canExecInEnvironment('member', { isProduction: false })).toBe(false);
    expect(canExecInEnvironment('member', { isProduction: true })).toBe(false);
  });

  it('allows only owner/admin to mutate config objects', () => {
    expect(canManageConfigObjects('owner')).toBe(true);
    expect(canManageConfigObjects('admin')).toBe(true);
    expect(canManageConfigObjects('member')).toBe(false);
  });
});
```

**步骤 2：运行测试，确认它先失败**

运行：`bun test src/lib/policies/__tests__/runtime-access.test.ts`  
预期：FAIL，提示模块不存在或导出缺失。

**步骤 3：写最小实现**

新增纯函数：

- `canReadProjectRuntime(role)`
- `canExecInEnvironment(role, environment)`
- `canManageConfigObjects(role)`
- `canManageTeamIntegrations(role)`
- `assertProjectScope(parentProjectId, resourceProjectId)`
- `assertTeamScope(parentTeamId, resourceTeamId)`

保持 `src/lib/policies/delivery.ts` 继续聚焦环境/发布治理，把高风险运行态动作权限移到 `runtime-access.ts`。

**步骤 4：再次运行测试，确认通过**

运行：`bun test src/lib/policies/__tests__/runtime-access.test.ts`  
预期：PASS。

**步骤 5：提交**

```bash
git add src/lib/policies/runtime-access.ts src/lib/policies/__tests__/runtime-access.test.ts src/lib/policies/delivery.ts
git commit -m "feat: add runtime authorization policy matrix"
```

---

### 任务 2：新增共享的 API 访问收口层

**文件：**
- Create: `src/lib/api/access.ts`
- Create: `src/lib/api/errors.ts`
- Test: `src/lib/api/__tests__/errors.test.ts`

**步骤 1：先写失败测试**

```ts
import { describe, expect, it } from 'bun:test';
import { accessError } from '@/lib/api/errors';

describe('api access errors', () => {
  it('normalizes forbidden responses', () => {
    expect(accessError('forbidden').status).toBe(403);
  });
});
```

**步骤 2：运行测试，确认它先失败**

运行：`bun test src/lib/api/__tests__/errors.test.ts`  
预期：FAIL，提示模块不存在。

**步骤 3：写最小实现**

在 `src/lib/api/access.ts` 中新增 DB 访问辅助：

- `requireSession()`
- `getTeamAccessOrThrow(teamId, userId)`
- `getProjectAccessOrThrow(projectId, userId)`
- `getProjectEnvironmentOrThrow(projectId, environmentId | null)`
- `getProjectServiceOrThrow(projectId, serviceId | null)`
- `getReleaseAccessOrThrow(releaseId, userId)`

在 `src/lib/api/errors.ts` 中新增统一错误模型：

- `unauthorized`
- `forbidden`
- `not_found`
- `invalid_scope`

所有 helper 都必须做父子归属校验：

- environment 必须属于 project
- service 必须属于 project
- release 必须属于 project / team

**步骤 4：再次运行测试，确认通过**

运行：`bun test src/lib/api/__tests__/errors.test.ts`  
预期：PASS。

**步骤 5：提交**

```bash
git add src/lib/api/access.ts src/lib/api/errors.ts src/lib/api/__tests__/errors.test.ts
git commit -m "feat: add shared api access helpers"
```

---

### 任务 3：优先加固高风险项目运行态路由

**文件：**
- Modify: `src/app/api/projects/[id]/resources/route.ts`
- Modify: `src/app/api/projects/[id]/resources/logs/route.ts`
- Modify: `src/app/api/projects/[id]/resources/exec/route.ts`
- Modify: `src/app/api/projects/[id]/resources/config/route.ts`
- Modify: `src/app/api/projects/[id]/env-vars/route.ts`
- Modify: `src/app/api/projects/[id]/env-vars/[varId]/route.ts`
- Test: `src/lib/policies/__tests__/runtime-access.test.ts`

**步骤 1：补一条失败测试**

在 `src/lib/policies/__tests__/runtime-access.test.ts` 里再补一条：

```ts
it('rejects mismatched project scope', () => {
  expect(() => assertProjectScope('project-a', 'project-b')).toThrow('invalid_scope');
});
```

**步骤 2：运行测试，确认它先失败**

运行：`bun test src/lib/policies/__tests__/runtime-access.test.ts`  
预期：FAIL，因为 `assertProjectScope` 尚未实现或不抛错。

**步骤 3：写最小实现**

把这些路由重构为：

- 通过 `requireSession()` 获取会话
- 通过 `getProjectAccessOrThrow()` 获取项目访问权
- environment / service 只能通过带 project scope 的 helper 解析
- 删掉这些文件里直接写的 `db.query.teamMembers.findFirst()`
- 接入统一权限规则：
  - `resources` / `logs`：只需要只读权限
  - `exec`：走 `canExecInEnvironment`
  - `config` POST / DELETE：走 `canManageConfigObjects`
  - env-vars create / update / delete：仍然 owner/admin，但必须加 environment 归属校验

关键修复要求：

- `environmentId` 在任何 K8s 调用前，必须先校验属于当前 `projectId`
- `syncEnvVarsToK8s(projectId, environmentId)` 只能吃项目内的环境

**步骤 4：再次运行测试，确认通过**

运行：`bun test src/lib/policies/__tests__/runtime-access.test.ts`  
预期：PASS。

**步骤 5：提交**

```bash
git add src/app/api/projects/[id]/resources/route.ts src/app/api/projects/[id]/resources/logs/route.ts src/app/api/projects/[id]/resources/exec/route.ts src/app/api/projects/[id]/resources/config/route.ts src/app/api/projects/[id]/env-vars/route.ts src/app/api/projects/[id]/env-vars/[varId]/route.ts src/lib/policies/__tests__/runtime-access.test.ts
git commit -m "fix: harden scoped runtime routes"
```

---

### 任务 4：把剩余 team / project 路由统一收口到访问层

**文件：**
- Modify: `src/app/api/projects/[id]/settings/route.ts`
- Modify: `src/app/api/projects/[id]/deployments/route.ts`
- Modify: `src/app/api/projects/[id]/resources/remediation/route.ts`
- Modify: `src/app/api/releases/[releaseId]/route.ts`
- Modify: `src/app/api/events/deployments/route.ts`
- Modify: `src/app/api/events/releases/route.ts`
- Modify: `src/app/api/teams/[id]/route.ts`
- Modify: `src/app/api/teams/[id]/members/route.ts`
- Modify: `src/app/api/teams/[id]/members/[memberId]/route.ts`
- Modify: `src/app/api/teams/[id]/invitations/route.ts`
- Modify: `src/app/api/teams/[id]/invitations/[invId]/route.ts`
- Test: `src/lib/projects/__tests__/service.test.ts`
- Test: `src/lib/teams/__tests__/service.test.ts`

**步骤 1：先写失败测试**

Create `src/lib/teams/__tests__/service.test.ts`

```ts
import { describe, expect, it } from 'bun:test';
import { buildTeamLayoutView } from '@/lib/teams/view';

describe('team service follow-up marker', () => {
  it('keeps a stable place for access-driven team views', () => {
    expect(buildTeamLayoutView({ id: 't1', name: 'Team', slug: 'team' }).title).toBe('Team');
  });
});
```

**步骤 2：运行测试，确认它先失败**

运行：`bun test src/lib/teams/__tests__/service.test.ts`  
预期：FAIL，因为文件还不存在。

**步骤 3：写最小实现**

把这些路由统一改成调用共享 helper，而不是各自手写 membership check。

具体规则：

- `teams/[id]` 系列走 `getTeamAccessOrThrow()`
- `releases/[releaseId]` 走 `getReleaseAccessOrThrow()`
- `events/*` 在进入 SSE 前先做项目级访问校验
- 这一批路由里，除了真正操作成员关系的地方，不再直接查 `teamMembers`

任务结束后补跑：

```bash
rg -n "db\\.query\\.teamMembers\\.findFirst\\(" src/app/api
```

预期：只剩成员管理场景和极少数合理例外。

**步骤 4：运行测试，确认通过**

运行：

```bash
bun test src/lib/projects/__tests__/service.test.ts
bun test src/lib/teams/__tests__/service.test.ts
```

预期：PASS。

**步骤 5：提交**

```bash
git add src/app/api/projects/[id]/settings/route.ts src/app/api/projects/[id]/deployments/route.ts src/app/api/projects/[id]/resources/remediation/route.ts src/app/api/releases/[releaseId]/route.ts src/app/api/events/deployments/route.ts src/app/api/events/releases/route.ts src/app/api/teams/[id]/route.ts src/app/api/teams/[id]/members/route.ts src/app/api/teams/[id]/members/[memberId]/route.ts src/app/api/teams/[id]/invitations/route.ts src/app/api/teams/[id]/invitations/[invId]/route.ts src/lib/teams/__tests__/service.test.ts
git commit -m "refactor: consolidate api authorization checks"
```

---

### 任务 5：新增团队集成绑定表与服务

**文件：**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/integrations/service/team-binding-service.ts`
- Create: `src/lib/integrations/__tests__/team-binding-service.test.ts`
- Create: `drizzle/XXXX_team_integration_bindings.sql`

**步骤 1：先写失败测试**

```ts
import { describe, expect, it } from 'bun:test';
import { chooseDefaultBinding } from '@/lib/integrations/service/team-binding-service';

describe('team integration binding service', () => {
  it('prefers the explicit default active binding', () => {
    expect(
      chooseDefaultBinding([
        { id: 'a', isDefault: false, revokedAt: null },
        { id: 'b', isDefault: true, revokedAt: null },
      ])?.id
    ).toBe('b');
  });
});
```

**步骤 2：运行测试，确认它先失败**

运行：`bun test src/lib/integrations/__tests__/team-binding-service.test.ts`  
预期：FAIL，提示模块不存在。

**步骤 3：写最小实现**

新增 `teamIntegrationBindings` 表：

- `id`
- `teamId`
- `integrationIdentityId`
- `createdByUserId`
- `authMode`（`personal` | `service`）
- `label`
- `isDefault`
- `revokedAt`
- `createdAt`
- `updatedAt`

新增服务函数：

- `listTeamIntegrationBindings(teamId)`
- `chooseDefaultBinding(bindings)`
- `createTeamIntegrationBinding(...)`
- `setDefaultTeamIntegrationBinding(teamId, bindingId)`
- `revokeTeamIntegrationBinding(teamId, bindingId)`
- `backfillOwnerBindingForTeam(teamId)`

说明：

- `backfillOwnerBindingForTeam()` 只是兼容阶段的临时手段
- 长期目标仍然是 bot / service-account 绑定

**步骤 4：再次运行测试，确认通过**

运行：`bun test src/lib/integrations/__tests__/team-binding-service.test.ts`  
预期：PASS。

**步骤 5：提交**

```bash
git add src/lib/db/schema.ts src/lib/integrations/service/team-binding-service.ts src/lib/integrations/__tests__/team-binding-service.test.ts drizzle/XXXX_team_integration_bindings.sql
git commit -m "feat: add team integration bindings"
```

---

### 任务 6：把集成控制面切到团队绑定模型

**文件：**
- Modify: `src/lib/integrations/service/integration-control-plane.ts`
- Modify: `src/lib/integrations/service/session-service.ts`
- Modify: `src/app/api/git/repositories/route.ts`
- Modify: `src/app/api/git/repositories/analyze/route.ts`
- Modify: `src/app/api/projects/route.ts`
- Modify: `src/app/api/projects/[id]/promote/route.ts`
- Modify: `src/lib/queue/project-init.ts`
- Modify: `src/lib/services/runtime-contract.ts`
- Modify: `src/lib/environments/review-metadata.ts`
- Modify: `src/lib/migrations/fetch.ts`
- Modify: `src/lib/migrations/resolver.ts`
- Test: `src/lib/integrations/__tests__/team-access-control.test.ts`

**步骤 1：先写失败测试**

```ts
import { describe, expect, it } from 'bun:test';
import { statusByCode } from '@/lib/integrations/service/integration-control-plane';

describe('team integration control plane', () => {
  it('treats missing team binding as forbidden or not found', () => {
    expect(statusByCode('INTEGRATION_NOT_BOUND')).toBe(404);
  });
});
```

**步骤 2：运行测试，确认它先失败**

运行：`bun test src/lib/integrations/__tests__/team-access-control.test.ts`  
预期：FAIL，因为测试文件还不存在，或导出不匹配。

**步骤 3：写最小实现**

把 `getTeamIntegrationSession()` 改成显式接收操作者：

```ts
getTeamIntegrationSession({
  teamId,
  actingUserId,
  bindingId,
  requiredCapabilities,
})
```

要求：

- 必须先验证 `actingUserId` 是该 `teamId` 的有效成员
- 默认解析当前团队的默认有效 binding，而不是再去找 team owner
- IntegrationSession 从 binding 对应的 identity / grant 构建
- 返回结果里带上 binding 元信息，用于后续审计

所有 Git 仓库 API、项目初始化流程、worker 入口都要切到这个新模型。

规则补充：

- 有用户触发的路径，必须传 `actingUserId`
- 纯 worker / 系统触发路径，可以走 system path，但仍然只能解析团队 binding，不能回退到 owner lookup

**步骤 4：再次运行测试，确认通过**

运行：`bun test src/lib/integrations/__tests__/team-access-control.test.ts`  
预期：PASS。

**步骤 5：提交**

```bash
git add src/lib/integrations/service/integration-control-plane.ts src/lib/integrations/service/session-service.ts src/app/api/git/repositories/route.ts src/app/api/git/repositories/analyze/route.ts src/app/api/projects/route.ts src/app/api/projects/[id]/promote/route.ts src/lib/queue/project-init.ts src/lib/services/runtime-contract.ts src/lib/environments/review-metadata.ts src/lib/migrations/fetch.ts src/lib/migrations/resolver.ts src/lib/integrations/__tests__/team-access-control.test.ts
git commit -m "feat: resolve integration sessions from team bindings"
```

---

### 任务 7：新增团队集成管理 UI 和 API

**文件：**
- Create: `src/app/teams/[id]/integrations/page.tsx`
- Create: `src/app/api/teams/[id]/integrations/route.ts`
- Create: `src/app/api/teams/[id]/integrations/[bindingId]/route.ts`
- Create: `src/components/teams/TeamIntegrationsClient.tsx`
- Modify: `src/app/teams/[id]/team-tab-nav.tsx`
- Modify: `src/lib/teams/service.ts`
- Modify: `src/lib/teams/view.ts`
- Test: `src/lib/teams/__tests__/integrations-view.test.ts`

**步骤 1：先写失败测试**

```ts
import { describe, expect, it } from 'bun:test';
import { buildTeamIntegrationsView } from '@/lib/teams/view';

describe('team integrations view', () => {
  it('flags degraded personal bindings', () => {
    const view = buildTeamIntegrationsView({
      role: 'owner',
      bindings: [
        {
          id: 'binding-1',
          authMode: 'personal',
          isDefault: true,
          revokedAt: null,
          ownerStillMember: false,
        },
      ],
    });
    expect(view.bindings[0]?.statusTone).toBe('danger');
  });
});
```

**步骤 2：运行测试，确认它先失败**

运行：`bun test src/lib/teams/__tests__/integrations-view.test.ts`  
预期：FAIL，提示导出缺失。

**步骤 3：写最小实现**

给 owner/admin 增加团队级集成管理界面，支持：

- 查看当前团队所有有效 binding 及其能力
- 设置默认 binding
- 撤销 binding
- 展示 binding 是 `service` 还是 `personal`
- 如果绑定来源用户已不在团队中，给出 degraded 警告
- 提供跳转到现有用户集成页的入口，方便先接入身份再绑定团队

同时在 Team Tab 里加一项：

- `概览`
- `成员`
- `集成`
- `设置`

**步骤 4：再次运行测试，确认通过**

运行：`bun test src/lib/teams/__tests__/integrations-view.test.ts`  
预期：PASS。

**步骤 5：提交**

```bash
git add src/app/teams/[id]/integrations/page.tsx src/app/api/teams/[id]/integrations/route.ts src/app/api/teams/[id]/integrations/[bindingId]/route.ts src/components/teams/TeamIntegrationsClient.tsx src/app/teams/[id]/team-tab-nav.tsx src/lib/teams/service.ts src/lib/teams/view.ts src/lib/teams/__tests__/integrations-view.test.ts
git commit -m "feat: add team integrations control plane"
```

---

### 任务 8：补齐个人绑定的离职保护

**文件：**
- Create: `src/lib/teams/offboarding-service.ts`
- Create: `src/lib/teams/__tests__/offboarding-service.test.ts`
- Modify: `src/app/api/teams/[id]/members/[memberId]/route.ts`
- Modify: `src/lib/integrations/service/team-binding-service.ts`

**步骤 1：先写失败测试**

```ts
import { describe, expect, it } from 'bun:test';
import { evaluateMemberRemovalImpact } from '@/lib/teams/offboarding-service';

describe('team offboarding impact', () => {
  it('blocks removing a user who owns the only default personal binding', () => {
    const result = evaluateMemberRemovalImpact({
      bindingSummaries: [
        {
          id: 'binding-1',
          authMode: 'personal',
          isDefault: true,
          sourceUserId: 'user-1',
        },
      ],
      targetUserId: 'user-1',
    });

    expect(result.blocking).toBe(true);
  });
});
```

**步骤 2：运行测试，确认它先失败**

运行：`bun test src/lib/teams/__tests__/offboarding-service.test.ts`  
预期：FAIL，提示模块不存在。

**步骤 3：写最小实现**

新增离职规则：

- 如果被移除成员正好是团队唯一默认 `personal` binding 的来源用户，则成员移除返回 `409`，并提示先替换默认 binding
- 如果该成员只持有非默认 `personal` binding`，则在移除时自动撤销这些 binding
- 如果团队只使用 `service` binding，则成员移除不受影响

注意：

- 不要因为团队成员移除，就全局 revoke 掉该用户所有 grant
- 这里只处理 team binding 这一层

**步骤 4：再次运行测试，确认通过**

运行：`bun test src/lib/teams/__tests__/offboarding-service.test.ts`  
预期：PASS。

**步骤 5：提交**

```bash
git add src/lib/teams/offboarding-service.ts src/lib/teams/__tests__/offboarding-service.test.ts src/app/api/teams/[id]/members/[memberId]/route.ts src/lib/integrations/service/team-binding-service.ts
git commit -m "feat: add team integration offboarding safeguards"
```

---

### 任务 9：清理认证漂移、对齐文档、补最终验证

**文件：**
- Modify: `src/proxy.ts`
- Modify: `AGENTS.md`
- Modify: `package.json`
- Test: `src/lib/integrations/__tests__/auth-grant-hooks.test.ts`

**步骤 1：先建立最终验证基线**

先运行：

```bash
bun test src/lib/integrations/__tests__/auth-grant-hooks.test.ts
bunx biome check src
```

预期：测试可能已通过，这一步主要是记录最终校验目标。

**步骤 2：写最小实现**

- 删除或改造 `src/proxy.ts`，避免它继续暗示存在一个实际上没生效的 dev auth 路径
- 更新 `AGENTS.md`：
  - 如果 `src/lib/api/*` 真实存在，就改成与实现一致
  - 如果某些设计还没落地，就不要继续写成已实现
  - 补充团队集成绑定模型和离职处理说明
- 在 `package.json` 里增加：

```json
"test": "bun test"
```

**步骤 3：跑最终验证**

运行：

```bash
bun test
bun run lint
```

预期：PASS。

**步骤 4：提交**

```bash
git add src/proxy.ts AGENTS.md package.json
git commit -m "chore: align auth docs and verification scripts"
```

---

## 数据迁移与发布检查清单

### 切换前

- 为 `teamIntegrationBindings` 创建 migration
- 给现有团队回填一个默认 binding，来源为当前 owner identity
- 统计哪些团队目前只使用 `personal` binding

### 兼容模式

- `getTeamIntegrationSession()` 先走默认 binding
- backfill 完成后，不再保留 owner lookup fallback
- 在团队集成 UI 中，对 `personal` binding 持续展示风险提示

### 强制模式

- 团队没有有效 binding 时，Git 仓库 API 直接报错
- 如果成员移除会导致团队失去唯一默认 `personal` binding，则直接阻断
- owner/admin 必须先替换 degraded binding，才能继续关键操作

## 验证清单

- `rg -n "db\\.query\\.teamMembers\\.findFirst\\(" src/app/api` 的结果显著下降
- `GET /api/git/repositories?teamId=<other-team>` 对非成员返回 403/404
- `GET /api/projects/:id/resources?env=<foreign-environment>` 在任何 K8s 调用前就被 scope 校验挡住
- `member` 无法执行 pod exec
- `member` 无法修改 Secret / ConfigMap
- 项目 create/import、worker 流程在存在有效 team binding 时可正常执行
- 使用 `service` binding 的团队，不受成员离职影响
- 如果被移除成员持有团队唯一默认 `personal` binding，会被明确阻断并提示处理步骤

## 风险与缓解

- 风险：backfill 之后，团队仍然依赖人的 binding
  - 缓解：在 UI 里明确标记 `personal` binding，并持续提示替换
- 风险：路由重构面较大，容易带出行为回归
  - 缓解：先收高风险路由，再批量推进剩余路由
- 风险：worker 流程默认假设一定有 `actingUserId`
  - 缓解：显式支持 system-triggered path，但仍要求走团队 binding
- 风险：后续文档继续漂移
  - 缓解：在最后一个任务里把 `AGENTS.md` 与真实目录和脚本对齐

## 推荐的执行拆分

1. 分支 A：任务 1-4，先做 authz 加固
2. 分支 B：任务 5，新增团队绑定 schema
3. 分支 C：任务 6-8，完成集成控制面切换和离职保护
4. 最终分支：任务 9，文档清理、验证脚本、全量回归

计划已保存到 [docs/plans/2026-04-09-authz-and-team-integration-hardening.md](/Users/findbiao/projects/Juanie/docs/plans/2026-04-09-authz-and-team-integration-hardening.md)。

后续有两个执行方式：

**1. 继续在当前会话里逐任务实现**  
我按这份计划一项项做，边做边复核。

**2. 单独开一个执行会话**  
用 `executing-plans` 风格按任务批量推进。

你定一个，我就接着往下做。
