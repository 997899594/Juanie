import { describe, expect, it } from 'bun:test';
import { buildHomePageData } from '@/lib/home/service';

describe('home service', () => {
  it('builds homepage data from fetched records', () => {
    const result = buildHomePageData({
      userName: 'Find',
      userTeams: [{ teamId: 'team-1', role: 'owner' }],
      userProjects: [{ id: 'proj-1', teamId: 'team-1', name: 'demo', status: 'active' }],
      attentionRuns: [
        {
          id: 'run-1',
          projectId: 'proj-1',
          releaseId: 'rel-1',
          status: 'failed',
          createdAt: '2026-03-26T00:00:00.000Z',
          database: { name: 'postgres' },
          project: { name: 'demo' },
        },
      ],
    });

    expect(result.headerDescription).toBe('Find');
    expect(result.stats[0]?.value).toBe(1);
    expect(result.projectCards[0]?.statusLabel).toBe('运行中');
    expect(result.attentionItems[0]?.issueLabel).toBe('迁移失败');
  });
});
