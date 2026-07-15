import { describe, expect, it } from 'bun:test';
import { buildInboxPageData } from '@/lib/inbox/service';

describe('inbox service', () => {
  it('surfaces one release migration plan instead of stage-level approvals', () => {
    const result = buildInboxPageData({
      filterState: 'approval',
      migrationRuns: [],
      migrationPlans: [
        {
          id: 'plan-1',
          releaseId: 'release-1',
          projectId: 'project-1',
          environmentId: 'env-1',
          sourceCommitSha: 'a'.repeat(40),
          digest: 'd'.repeat(64),
          stageCount: 4,
          projectName: 'demo',
          environmentName: 'production',
        },
      ],
      schemaDatabases: [],
    });

    expect(result.migrationPlans.length).toBe(1);
    expect(result.stats).toEqual([
      { label: '全部', value: 1 },
      { label: '迁移待办', value: 1 },
      { label: '数据库状态', value: 0 },
      { label: '需要我处理', value: 1 },
    ]);
  });

  it('surfaces migration attention and schema attention together', () => {
    const result = buildInboxPageData({
      filterState: 'all',
      migrationRuns: [
        {
          id: 'run-1',
          projectId: 'proj-1',
          releaseId: 'rel-1',
          status: 'awaiting_approval',
          createdAt: '2026-03-26T00:00:00.000Z',
          database: { name: 'postgres', type: 'postgresql' },
          environment: { id: 'env-1', name: 'production' },
          project: { name: 'demo' },
          specification: { tool: 'atlas', phase: 'preDeploy', command: 'atlas migrate apply' },
        },
      ],
      schemaDatabases: [
        {
          id: 'db-1',
          projectId: 'proj-1',
          name: 'postgres',
          type: 'postgresql',
          project: { id: 'proj-1', name: 'demo' },
          environment: { id: 'env-1', name: 'production' },
          schemaState: {
            status: 'pending_migrations',
            summary: '有 1 个迁移待执行',
            lastInspectedAt: '2026-03-26T00:00:00.000Z',
          },
        },
      ],
    });

    expect(result.stats).toEqual([
      { label: '全部', value: 2 },
      { label: '迁移待办', value: 1 },
      { label: '数据库状态', value: 1 },
      { label: '需要我处理', value: 1 },
    ]);
    expect(result.attentionRuns.length).toBe(1);
    expect(result.schemaItems.length).toBe(1);
    expect(result.schemaItems[0]?.statusLabel).toBe('待执行迁移');
  });

  it('filters schema attention separately from migration approvals', () => {
    const result = buildInboxPageData({
      filterState: 'schema',
      migrationRuns: [
        {
          id: 'run-1',
          projectId: 'proj-1',
          status: 'awaiting_approval',
          createdAt: '2026-03-26T00:00:00.000Z',
          database: { name: 'postgres', type: 'postgresql' },
          environment: { id: 'env-1', name: 'production' },
          project: { name: 'demo' },
          specification: { tool: 'atlas', phase: 'preDeploy', command: 'atlas migrate apply' },
        },
      ],
      schemaDatabases: [
        {
          id: 'db-1',
          projectId: 'proj-1',
          name: 'postgres',
          type: 'postgresql',
          project: { id: 'proj-1', name: 'demo' },
          environment: { id: 'env-1', name: 'production' },
          schemaState: {
            status: 'drifted',
            lastInspectedAt: '2026-03-26T00:00:00.000Z',
          },
        },
      ],
    });

    expect(result.attentionRuns).toEqual([]);
    expect(result.schemaItems.map((item) => item.status)).toEqual(['drifted']);
    expect(result.schemaItems[0]?.tone).toBe('danger');
  });

  it('does not surface resolved failed migrations or aligned schema states', () => {
    const result = buildInboxPageData({
      filterState: 'all',
      migrationRuns: [
        {
          id: 'run-1',
          projectId: 'proj-1',
          status: 'failed',
          createdAt: '2026-03-26T00:00:00.000Z',
          database: {
            name: 'postgres',
            type: 'postgresql',
            schemaState: { status: 'aligned' },
          },
          environment: { id: 'env-1', name: 'production' },
          project: { name: 'demo' },
          specification: { tool: 'atlas', phase: 'preDeploy', command: 'atlas migrate apply' },
        },
      ],
      schemaDatabases: [
        {
          id: 'db-1',
          projectId: 'proj-1',
          name: 'postgres',
          type: 'postgresql',
          project: { id: 'proj-1', name: 'demo' },
          environment: { id: 'env-1', name: 'production' },
          schemaState: {
            status: 'aligned',
            lastInspectedAt: '2026-03-26T00:00:00.000Z',
          },
        },
      ],
    });

    expect(result.stats[0]?.value).toBe(0);
    expect(result.attentionRuns).toEqual([]);
    expect(result.schemaItems).toEqual([]);
  });

  it('does not surface runtime-only databases as schema attention', () => {
    const result = buildInboxPageData({
      filterState: 'all',
      migrationRuns: [],
      schemaDatabases: [
        {
          id: 'db-redis',
          projectId: 'proj-1',
          name: 'redis',
          type: 'redis',
          project: { id: 'proj-1', name: 'demo' },
          environment: { id: 'env-1', name: 'staging' },
          schemaState: {
            status: 'unmanaged',
            summary: '仓库中没有匹配当前数据库的迁移配置',
            lastInspectedAt: '2026-06-11T08:44:00.000Z',
          },
        },
      ],
    });

    expect(result.stats[0]?.value).toBe(0);
    expect(result.schemaItems).toEqual([]);
  });
});
