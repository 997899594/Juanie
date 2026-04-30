import { describe, expect, it } from 'bun:test';
import { buildPromotionPlanUrl } from '@/lib/releases/client-actions';

describe('release client actions', () => {
  it('builds promotion plan urls with optional schema refresh', () => {
    expect(buildPromotionPlanUrl({ projectId: 'project-1' })).toBe(
      '/api/projects/project-1/promote'
    );
    expect(
      buildPromotionPlanUrl({
        projectId: 'project-1',
        flowId: 'flow-1',
        refreshSchema: true,
      })
    ).toBe('/api/projects/project-1/promote?flowId=flow-1&refreshSchema=true');
  });
});
