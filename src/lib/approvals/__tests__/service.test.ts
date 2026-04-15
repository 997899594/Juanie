import { describe, expect, it } from 'bun:test';
import { buildApprovalsPageData } from '@/lib/approvals/service';

describe('approvals service', () => {
  it('builds approval stats and filtered decorated runs', () => {
    const result = buildApprovalsPageData({
      filterState: 'approval',
      runs: [
        {
          id: 'run-1',
          projectId: 'proj-1',
          releaseId: 'rel-1',
          status: 'awaiting_approval',
          createdAt: '2026-03-26T00:00:00.000Z',
          database: { name: 'postgres', type: 'postgresql' },
          environment: { name: 'production' },
          project: { name: 'demo' },
          specification: { tool: 'drizzle', phase: 'preDeploy', command: 'bun run db:push' },
        },
        {
          id: 'run-2',
          projectId: 'proj-1',
          status: 'failed',
          createdAt: '2026-03-26T00:00:00.000Z',
          database: { name: 'postgres', type: 'postgresql' },
          environment: { name: 'production' },
          project: { name: 'demo' },
          specification: { tool: 'drizzle', phase: 'preDeploy', command: 'bun run db:push' },
        },
        {
          id: 'run-3',
          projectId: 'proj-1',
          status: 'canceled',
          createdAt: '2026-03-26T00:00:00.000Z',
          database: { name: 'postgres', type: 'postgresql' },
          environment: { name: 'production' },
          project: { name: 'demo' },
          specification: { tool: 'drizzle', phase: 'preDeploy', command: 'bun run db:push' },
        },
      ],
    });

    expect(result.stats[0]?.value).toBe(2);
    expect(result.stats[1]?.value).toBe(1);
    expect(result.stats[4]?.value).toBe(1);
    expect(result.attentionRuns.length).toBe(1);
    expect(result.attentionRuns[0]?.issueLabel).toBe('审批阻塞');
  });

  it('only keeps the latest run for the same lockKey in stats and lists', () => {
    const result = buildApprovalsPageData({
      filterState: 'failed',
      runs: [
        {
          id: 'run-1',
          projectId: 'proj-1',
          releaseId: 'rel-1',
          lockKey: 'db-1:env-1',
          status: 'failed',
          createdAt: '2026-03-25T00:00:00.000Z',
          database: { name: 'postgres', type: 'postgresql' },
          environment: { name: 'production' },
          project: { name: 'demo' },
          specification: { tool: 'drizzle', phase: 'preDeploy', command: 'bun run db:push' },
        },
        {
          id: 'run-2',
          projectId: 'proj-1',
          releaseId: 'rel-2',
          lockKey: 'db-1:env-1',
          status: 'failed',
          createdAt: '2026-03-26T00:00:00.000Z',
          database: { name: 'postgres', type: 'postgresql' },
          environment: { name: 'production' },
          project: { name: 'demo' },
          specification: { tool: 'drizzle', phase: 'preDeploy', command: 'bun run db:push' },
        },
      ],
    });

    expect(result.stats[0]?.value).toBe(1);
    expect(result.stats[3]?.value).toBe(1);
    expect(result.attentionRuns.map((run) => run.id)).toEqual(['run-2']);
  });
});
