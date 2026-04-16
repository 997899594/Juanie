import { describe, expect, it } from 'bun:test';
import { buildReleasePageGovernanceSnapshot } from '@/lib/releases/governance-view';

describe('release governance view', () => {
  it('allows members to promote into manageable non-production targets', () => {
    const snapshot = buildReleasePageGovernanceSnapshot({
      role: 'member',
      environments: [
        { id: 'env-dev', name: 'dev', isProduction: false },
        { id: 'env-staging', name: 'staging', isProduction: false },
        { id: 'env-prod', name: 'production', isProduction: true },
      ],
      promotionTargets: [
        { id: 'env-staging', name: 'staging', isProduction: false },
        { id: 'env-prod', name: 'production', isProduction: true },
      ],
    });

    expect(snapshot.promotion.allowed).toBe(true);
    expect(snapshot.promotion.manageableTargetIds).toEqual(['env-staging']);
    expect(snapshot.promotion.summary).toBe('部分提升链路受保护，当前仅可操作可管理目标环境');
  });

  it('reports when no promotion flows are configured', () => {
    const snapshot = buildReleasePageGovernanceSnapshot({
      role: 'admin',
      environments: [{ id: 'env-main', name: 'mainline', isProduction: false }],
      promotionTargets: [],
    });

    expect(snapshot.promotion.allowed).toBe(false);
    expect(snapshot.promotion.summary).toBe('当前项目还没有配置环境提升链路');
  });
});
