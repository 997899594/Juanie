import { describe, expect, it } from 'bun:test';
import {
  assertReleaseMigrationPlanIntegrity,
  computeReleaseMigrationPlanDigest,
} from '@/lib/migrations/release-plan';
import type { ReleaseMigrationPlanSnapshot } from '@/lib/migrations/release-plan-types';

function createSnapshot(): ReleaseMigrationPlanSnapshot {
  return {
    version: 1,
    releaseId: 'release-1',
    projectId: 'project-1',
    environmentId: 'env-1',
    sourceRepository: 'acme/app',
    sourceRef: 'main',
    sourceCommitSha: 'a'.repeat(40),
    stages: [
      {
        stageKey: 'spec-1:service-1:db-1:expand',
        specificationId: 'spec-1',
        serviceId: 'service-1',
        serviceName: 'api',
        databaseId: 'db-1',
        databaseName: 'primary',
        databaseType: 'postgresql',
        phase: 'preDeploy',
        specification: {
          source: 'atlas',
          tool: 'atlas',
          phase: 'preDeploy',
          executionMode: 'manual_platform',
          releaseStage: 'expand',
          stageOrder: 10,
          targetVersion: '202607150001',
          baselineVersion: '202607140001',
          sourceConfigPath: 'atlas.hcl',
          migrationPath: 'migrations',
          command: 'internal:atlas',
          lockStrategy: 'platform',
          compatibility: 'backward_compatible',
          approvalPolicy: 'manual_in_production',
        },
        filePreview: {
          sourceLabel: 'Atlas commit aaaaaaaaaaaa',
          files: ['202607150001_expand.sql'],
          fileDetails: [
            {
              path: '202607150001_expand.sql',
              content: 'ALTER TABLE notes ADD COLUMN title text;',
              truncated: false,
              language: 'sql',
            },
          ],
          total: 1,
          declaredTotal: 1,
          executedTotal: 0,
          truncated: false,
          warning: null,
        },
      },
    ],
  };
}

describe('release migration plan integrity', () => {
  it('produces a stable digest for the immutable plan snapshot', () => {
    const snapshot = createSnapshot();
    expect(computeReleaseMigrationPlanDigest(snapshot).length).toBe(64);
    expect(computeReleaseMigrationPlanDigest(snapshot)).toBe(
      computeReleaseMigrationPlanDigest(structuredClone(snapshot))
    );
  });

  it('blocks execution when approved migration content changes', () => {
    const snapshot = createSnapshot();
    const digest = computeReleaseMigrationPlanDigest(snapshot);
    snapshot.stages[0]!.filePreview.fileDetails![0]!.content = 'DROP TABLE notes;';

    expect(() =>
      assertReleaseMigrationPlanIntegrity({
        digest,
        approvedDigest: digest,
        status: 'approved',
        sourceCommitSha: 'a'.repeat(40),
        snapshot,
        releaseSourceCommitSha: 'a'.repeat(40),
      })
    ).toThrow('迁移计划摘要校验失败');
  });
});
