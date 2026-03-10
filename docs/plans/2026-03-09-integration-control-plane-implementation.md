# Integration Control Plane Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single Integration Control Plane that becomes the only authorization, capability, and Git operation entrypoint across auth, API, worker, and UI, with one-shot cutover and no legacy compatibility.

**Architecture:** Introduce a new `src/lib/integrations` domain/service/adapter stack to encapsulate grants, capabilities, sessions, and provider calls. Migrate all Git-facing workflows (OAuth persistence, repository browsing/analyze, project init operations) to require integration sessions with explicit capabilities. Remove direct `gitProviders.accessToken` reads and provider client instantiation from business flows.

**Tech Stack:** Next.js App Router, NextAuth, Drizzle ORM/PostgreSQL, BullMQ worker, TypeScript, Bun test runtime.

---

### Task 1: Add integration schema primitives

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/integrations/domain/models.ts`
- Test: `src/lib/integrations/__tests__/capability-types.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { CAPABILITIES } from '@/lib/integrations/domain/models';

describe('integration capability catalog', () => {
  it('includes workflow and webhook capabilities', () => {
    expect(CAPABILITIES).toContain('write_workflow');
    expect(CAPABILITIES).toContain('manage_webhook');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/integrations/__tests__/capability-types.test.ts`
Expected: FAIL with module-not-found or missing export for `@/lib/integrations/domain/models`.

**Step 3: Write minimal implementation**

In `src/lib/db/schema.ts`, add new tables + enum:
- `integration_identity`
- `integration_grant`
- `integration_capability_snapshot`
- capability enum (text or pgEnum-backed)

In `src/lib/integrations/domain/models.ts`, add:
```ts
export const CAPABILITIES = [
  'read_repo',
  'write_repo',
  'write_workflow',
  'manage_webhook',
] as const;
export type Capability = (typeof CAPABILITIES)[number];
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/integrations/__tests__/capability-types.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/integrations/domain/models.ts src/lib/integrations/__tests__/capability-types.test.ts
git commit -m "feat: add integration schema and capability catalog"
```

---

### Task 2: Implement domain errors and capability resolver

**Files:**
- Create: `src/lib/integrations/domain/errors.ts`
- Create: `src/lib/integrations/domain/capability.ts`
- Test: `src/lib/integrations/__tests__/capability-resolver.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { resolveGitHubCapabilities } from '@/lib/integrations/domain/capability';

describe('resolveGitHubCapabilities', () => {
  it('maps repo without workflow correctly', () => {
    const caps = resolveGitHubCapabilities(['repo', 'user:email']);
    expect(caps).toContain('write_repo');
    expect(caps).not.toContain('write_workflow');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/integrations/__tests__/capability-resolver.test.ts`
Expected: FAIL with missing function import.

**Step 3: Write minimal implementation**

In `capability.ts`, implement:
- `resolveGitHubCapabilities(scopes: string[]): Capability[]`
- `resolveGitLabCapabilities(scopes: string[]): Capability[]`
- deterministic dedupe + sort.

In `errors.ts`, implement structured domain errors:
```ts
export type IntegrationErrorCode =
  | 'INTEGRATION_NOT_BOUND'
  | 'GRANT_EXPIRED'
  | 'GRANT_REVOKED'
  | 'MISSING_CAPABILITY'
  | 'PROVIDER_ACCESS_DENIED'
  | 'PROVIDER_RESOURCE_NOT_FOUND';
```
and helper constructors.

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/integrations/__tests__/capability-resolver.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/integrations/domain/errors.ts src/lib/integrations/domain/capability.ts src/lib/integrations/__tests__/capability-resolver.test.ts
git commit -m "feat: add capability resolver and integration error model"
```

---

### Task 3: Build grant + session services

**Files:**
- Create: `src/lib/integrations/service/grant-service.ts`
- Create: `src/lib/integrations/service/session-service.ts`
- Test: `src/lib/integrations/__tests__/session-service.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { assertCapabilities } from '@/lib/integrations/service/session-service';

describe('assertCapabilities', () => {
  it('throws missing capability error when required capability absent', () => {
    expect(() => assertCapabilities(['read_repo'], ['write_workflow'])).toThrow(
      'MISSING_CAPABILITY(write_workflow)'
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/integrations/__tests__/session-service.test.ts`
Expected: FAIL with missing module/function.

**Step 3: Write minimal implementation**

`grant-service.ts`:
- `upsertGrantFromOAuth({ userId, provider, accessToken, refreshToken, expiresAt, scopeRaw })`
- `revokeActiveGrants(userId)`
- persist capability snapshot.

`session-service.ts`:
- `createIntegrationSession({ integrationId, teamId, requiredCapabilities })`
- `assertCapabilities(granted, required)` throwing structured `MISSING_CAPABILITY(cap)`.

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/integrations/__tests__/session-service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/integrations/service/grant-service.ts src/lib/integrations/service/session-service.ts src/lib/integrations/__tests__/session-service.test.ts
git commit -m "feat: implement integration grant and session services"
```

---

### Task 4: Build integration adapters and gateway

**Files:**
- Create: `src/lib/integrations/adapters/github-adapter.ts`
- Create: `src/lib/integrations/adapters/gitlab-adapter.ts`
- Create: `src/lib/integrations/service/integration-control-plane.ts`
- Test: `src/lib/integrations/__tests__/provider-error-mapping.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { mapProviderError } from '@/lib/integrations/service/integration-control-plane';

describe('mapProviderError', () => {
  it('maps provider 404 to PROVIDER_RESOURCE_NOT_FOUND', () => {
    const err = mapProviderError({ status: 404, message: 'Not Found' });
    expect(err.code).toBe('PROVIDER_RESOURCE_NOT_FOUND');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/integrations/__tests__/provider-error-mapping.test.ts`
Expected: FAIL with missing export.

**Step 3: Write minimal implementation**

Adapters wrap existing provider behavior but accept `IntegrationSession` instead of raw token.

`integration-control-plane.ts` exports:
- `getTeamIntegrationSession(...)`
- `gateway.listRepositories(...)`
- `gateway.getRepository(...)`
- `gateway.pushFiles(...)`
- `gateway.createWebhook(...)`
- `gateway.setupRegistryWebhook(...)`
- `mapProviderError(...)`

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/integrations/__tests__/provider-error-mapping.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/integrations/adapters/github-adapter.ts src/lib/integrations/adapters/gitlab-adapter.ts src/lib/integrations/service/integration-control-plane.ts src/lib/integrations/__tests__/provider-error-mapping.test.ts
git commit -m "feat: add integration gateway adapters and provider error mapping"
```

---

### Task 5: Switch auth OAuth persistence to control plane

**Files:**
- Modify: `src/lib/auth.ts`
- Test: `src/lib/integrations/__tests__/auth-grant-hooks.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { onOAuthGrantPersist, onAuthSignOut } from '@/lib/auth';

describe('auth integration hooks', () => {
  it('calls revoke flow on sign out', async () => {
    const result = await onAuthSignOut('user-1');
    expect(result.ok).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/integrations/__tests__/auth-grant-hooks.test.ts`
Expected: FAIL due to missing exported helper(s).

**Step 3: Write minimal implementation**

In `src/lib/auth.ts`:
- OAuth callback uses `upsertGrantFromOAuth`.
- signOut event uses `revokeActiveGrants(userId)`.
- remove direct `gitProviders` token update path.
- GitHub scope aligns with required capability surface (`workflow` included).

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/integrations/__tests__/auth-grant-hooks.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/integrations/__tests__/auth-grant-hooks.test.ts
git commit -m "refactor: route auth grant lifecycle through integration control plane"
```

---

### Task 6: Migrate repository APIs to integration sessions

**Files:**
- Modify: `src/app/api/git/repositories/route.ts`
- Modify: `src/app/api/git/repositories/analyze/route.ts`
- Test: `src/lib/integrations/__tests__/git-api-capability-gate.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { normalizeApiError } from '@/lib/integrations/service/integration-control-plane';

describe('api error normalization', () => {
  it('exposes structured missing capability error', () => {
    const error = normalizeApiError({ code: 'MISSING_CAPABILITY', capability: 'read_repo' });
    expect(error.error.code).toBe('MISSING_CAPABILITY(read_repo)');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/integrations/__tests__/git-api-capability-gate.test.ts`
Expected: FAIL due to missing normalization behavior.

**Step 3: Write minimal implementation**

API routes should:
- stop accepting `providerId` trust mode.
- accept/select `integrationId`.
- create session with required capabilities.
- use gateway methods only.
- return unified error payload.

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/integrations/__tests__/git-api-capability-gate.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/git/repositories/route.ts src/app/api/git/repositories/analyze/route.ts src/lib/integrations/__tests__/git-api-capability-gate.test.ts
git commit -m "refactor: enforce integration session model in git repository APIs"
```

---

### Task 7: Migrate project init worker to capability-gated sessions

**Files:**
- Modify: `src/lib/queue/project-init.ts`
- Test: `src/lib/integrations/__tests__/project-init-capability-gate.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { requiredCapabilitiesForStep } from '@/lib/queue/project-init';

describe('project init capability gates', () => {
  it('requires write_workflow for push_cicd_config', () => {
    expect(requiredCapabilitiesForStep('push_cicd_config')).toContain('write_workflow');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/integrations/__tests__/project-init-capability-gate.test.ts`
Expected: FAIL because capability map is not defined/exported.

**Step 3: Write minimal implementation**

In `project-init.ts`:
- replace `getTeamGitProvider` with `getTeamIntegrationSession`.
- add step -> required capabilities map:
  - `validate_repository`: `read_repo`
  - `push_cicd_config` / `push_template`: `write_repo` + `write_workflow`
  - `setup_webhook` / `setup_registry_webhook`: `manage_webhook`
- convert provider failures into structured integration errors.

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/integrations/__tests__/project-init-capability-gate.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/queue/project-init.ts src/lib/integrations/__tests__/project-init-capability-gate.test.ts
git commit -m "refactor: gate project init steps with integration capabilities"
```

---

### Task 8: Update project creation UI/API contract to integration-first

**Files:**
- Modify: `src/components/projects/create-project-form.tsx`
- Modify: `src/app/projects/new/page.tsx`
- Modify: `src/app/api/projects/route.ts`
- Test: `src/lib/integrations/__tests__/project-create-integration-contract.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { validateProjectCreatePayload } from '@/app/api/projects/route';

describe('project create payload', () => {
  it('requires integrationId instead of gitProviderId', () => {
    const result = validateProjectCreatePayload({ name: 'demo', gitProviderId: 'legacy' } as any);
    expect(result.ok).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/integrations/__tests__/project-create-integration-contract.test.ts`
Expected: FAIL because validation does not enforce integration model.

**Step 3: Write minimal implementation**

- UI replaces provider selection/wiring with integration selection + capability display.
- Submit payload uses `integrationId`.
- API create route stores integration reference and rejects legacy fields.

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/integrations/__tests__/project-create-integration-contract.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/projects/create-project-form.tsx src/app/projects/new/page.tsx src/app/api/projects/route.ts src/lib/integrations/__tests__/project-create-integration-contract.test.ts
git commit -m "refactor: migrate project creation flow to integration-first contract"
```

---

### Task 9: Remove legacy gitProvider direct-token paths

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/queue/project-init.ts`
- Modify: `src/app/api/git/repositories/route.ts`
- Modify: `src/app/api/git/repositories/analyze/route.ts`
- Modify: `src/lib/db/schema.ts`
- Test: `src/lib/integrations/__tests__/no-legacy-token-paths.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('legacy token path removal', () => {
  it('does not use gitProviders.accessToken in migrated paths', () => {
    const content = readFileSync('src/lib/queue/project-init.ts', 'utf8');
    expect(content.includes('provider.accessToken')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/integrations/__tests__/no-legacy-token-paths.test.ts`
Expected: FAIL showing legacy token access still present.

**Step 3: Write minimal implementation**

- remove all direct token reads in migrated files.
- keep legacy table only if still needed for migration window internals; business logic must not reference `accessToken`.
- remove dead helper(s) like `getTeamGitProvider`.

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/integrations/__tests__/no-legacy-token-paths.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/queue/project-init.ts src/app/api/git/repositories/route.ts src/app/api/git/repositories/analyze/route.ts src/lib/db/schema.ts src/lib/integrations/__tests__/no-legacy-token-paths.test.ts
git commit -m "refactor: remove legacy gitProvider token access from business flows"
```

---

### Task 10: Validate full integration control-plane cutover

**Files:**
- Modify: `package.json`
- Create: `src/lib/integrations/__tests__/integration-cutover.smoke.test.ts`
- Modify: `docs/plans/2026-03-09-integration-control-plane-design.md` (append implementation status checklist)

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';

describe('integration cutover smoke', () => {
  it('placeholder smoke verifies control-plane entrypoint exports', async () => {
    const mod = await import('@/lib/integrations/service/integration-control-plane');
    expect(typeof mod.getTeamIntegrationSession).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/integrations/__tests__/integration-cutover.smoke.test.ts`
Expected: FAIL if exports are missing/inconsistent.

**Step 3: Write minimal implementation**

- ensure all final exports are stable.
- add `"test": "bun test"` script in `package.json` for repeatable verification.
- append done-checklist in design doc to record one-shot migration completion.

**Step 4: Run test suite to verify it passes**

Run: `bun test src/lib/integrations/__tests__/*.test.ts`
Expected: PASS across integration test files.

Run: `bun run lint`
Expected: PASS with no biome errors.

**Step 5: Commit**

```bash
git add package.json src/lib/integrations/__tests__/integration-cutover.smoke.test.ts docs/plans/2026-03-09-integration-control-plane-design.md
git commit -m "chore: finalize integration control-plane cutover verification"
```

---

## End-to-end Verification Checklist

1. OAuth login stores/updates integration grant and capability snapshot.
2. Sign-out revokes active grants.
3. `/api/git/repositories` and `/api/git/repositories/analyze` require integration session, not providerId trust.
4. Project init worker gates each step by capabilities and emits structured errors (`MISSING_CAPABILITY(...)`, etc).
5. Missing workflow scope no longer appears as raw provider 404 in business layer.
6. No direct `gitProviders.accessToken` reads in migrated business flows.

## Notes for execution

- Keep commits small and task-scoped (one task = one commit).
- Follow DRY/YAGNI; avoid introducing compatibility shims.
- If any step reveals unknown coupling, update plan file before implementation continues.
