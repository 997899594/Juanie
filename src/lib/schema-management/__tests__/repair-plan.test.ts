import { describe, expect, it } from 'bun:test';
import { buildSchemaRepairPlan } from '@/lib/schema-management/repair-plan';

describe('schema repair plan', () => {
  it('treats pending migrations as normal release work', () => {
    const plan = buildSchemaRepairPlan({
      status: 'pending_migrations',
      summary: '数据库落后于仓库迁移链，已执行 1/2 项，可通过正常发布补齐',
      expectedVersion: '0002_add_users',
      actualVersion: '0001_init',
    });

    expect(plan.kind).toBe('run_release_migrations');
    expect(plan.riskLevel).toBe('low');
    expect(plan.nextActionLabel).toContain('正常发布');
  });

  it('treats drift as repair PR work', () => {
    const plan = buildSchemaRepairPlan({
      status: 'drifted',
      summary: '数据库账本与仓库 Drizzle 迁移链不一致',
      expectedVersion: '0002_add_users',
      actualVersion: '0001_custom_hotfix',
    });

    expect(plan.kind).toBe('repair_pr_required');
    expect(plan.riskLevel).toBe('high');
    expect(plan.steps[1]).toContain('repair migration');
  });
});
