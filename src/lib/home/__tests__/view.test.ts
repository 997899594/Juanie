import { describe, expect, it } from 'bun:test';
import { buildHomeStats, decorateHomeAttentionRuns, decorateHomeProjects } from '@/lib/home/view';

describe('home view', () => {
  it('builds home stats in the expected order', () => {
    expect(
      buildHomeStats({
        projectCount: 2,
        teamCount: 1,
        attentionCount: 3,
        activeProjectCount: 1,
      })
    ).toEqual([
      { label: '项目', value: 2 },
      { label: '团队', value: 1 },
      { label: '待处理', value: 3 },
      { label: '运行中', value: 1 },
    ]);
  });

  it('decorates home projects with repository and status labels', () => {
    const result = decorateHomeProjects([
      {
        id: 'p1',
        teamId: 'team-1',
        name: 'demo',
        status: 'active',
        repository: { fullName: 'juanie/demo' },
      },
    ]);

    expect(result[0]?.statusLabel).toBe('运行中');
    expect(result[0]?.repositoryLabel).toBe('juanie/demo');
  });

  it('decorates attention runs with links and labels', () => {
    const result = decorateHomeAttentionRuns([
      {
        id: 'run-1',
        projectId: 'proj-1',
        releaseId: 'rel-1',
        status: 'awaiting_approval',
        createdAt: '2026-03-26T00:00:00.000Z',
        database: { name: 'postgres' },
        project: { name: 'demo' },
      },
    ]);

    expect(result[0]?.issueLabel).toBe('审批阻塞');
    expect(result[0]?.actionLabel).toBe('处理迁移审批');
    expect(result[0]?.href).toBe('/projects/proj-1/delivery/rel-1');
    expect(result[0]?.databaseName).toBe('postgres');
    expect(result[0]?.projectName).toBe('demo');
  });
});
