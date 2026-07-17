import { describe, expect, it } from 'bun:test';
import { planPlatformImages, platformImageTargets } from '../plan-platform-images';

describe('platform image planner', () => {
  it('skips images for deployment and documentation changes', () => {
    expect(
      planPlatformImages([
        'deploy/k8s/charts/juanie/templates/rbac.yaml',
        '.github/workflows/ci.yml',
        'docs/adr/0005-content-addressed-platform-image-releases.md',
        'scripts/validate-scheduler-rbac.ts',
      ]).targets
    ).toEqual([]);
  });

  it('builds only schema-runner for migration-only changes', () => {
    expect(
      planPlatformImages([
        'migrations/20260717090000_add_manage_webhook_capability.sql',
        'migrations/atlas.sum',
      ]).targets
    ).toEqual(['schema-runner']);
  });

  it('builds every target when shared application source changes', () => {
    expect(planPlatformImages(['src/lib/git/github.ts']).targets).toEqual(platformImageTargets);
  });

  it('builds every target for unknown root inputs', () => {
    expect(planPlatformImages(['new-runtime.config.mjs']).targets).toEqual(platformImageTargets);
  });

  it('builds every target when dependency preparation changes', () => {
    expect(planPlatformImages(['scripts/prepare.ts']).targets).toEqual(platformImageTargets);
  });

  it('normalizes duplicate paths for deterministic output', () => {
    expect(planPlatformImages(['docs/z.md', 'docs/a.md', 'docs/z.md']).changedPaths).toEqual([
      'docs/a.md',
      'docs/z.md',
    ]);
  });
});
