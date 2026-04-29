import { describe, expect, it } from 'bun:test';
import {
  buildInitialAutoDeploySummary,
  resolveInitialAutoDeployRefs,
} from '@/lib/projects/initial-auto-deploy';

describe('project init initial build trigger helpers', () => {
  it('deduplicates persistent auto-deploy refs', () => {
    expect(
      resolveInitialAutoDeployRefs([
        { branch: 'main', autoDeploy: true, isPreview: false },
        { branch: 'develop', autoDeploy: true, isPreview: false },
        { branch: 'main', autoDeploy: true, isPreview: false },
        { branch: 'preview-codex', autoDeploy: true, isPreview: true },
      ])
    ).toEqual(['refs/heads/main', 'refs/heads/develop']);
  });

  it('builds a readable summary when secondary refs are missing', () => {
    expect(
      buildInitialAutoDeploySummary({
        refs: ['refs/heads/main', 'refs/heads/develop', 'refs/heads/test'],
        triggeredRefs: ['refs/heads/main'],
        missingRefs: ['refs/heads/develop', 'refs/heads/test'],
      })
    ).toBe('已触发 1 个首发构建，跳过不存在的分支：develop、test');
  });
});
