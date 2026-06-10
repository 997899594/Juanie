import { describe, expect, it } from 'bun:test';
import { getAdmissionFailureResponsePayload } from '@/lib/releases/admission-response';
import { PreviewDatabaseGuardBlockedError } from '@/lib/releases/preview-database-guard';
import { ReleaseSchemaGateBlockedError } from '@/lib/releases/schema-gate';

const admissionRelease = {
  id: 'release-1',
  projectId: 'project-1',
  environmentId: 'env-1',
};

describe('release admission failure response', () => {
  it('exposes a release detail path for schema gate failures', () => {
    const payload = getAdmissionFailureResponsePayload(
      new ReleaseSchemaGateBlockedError(
        {
          canCreate: false,
          checkedCount: 1,
          blockingCount: 1,
          states: [],
          summary: 'Schema gate failed',
          blockingReason: '存在 1 个数据库 schema 门禁未满足',
          nextActionLabel: '修复 Schema',
          customSignals: [],
        },
        admissionRelease
      )
    );

    expect(payload).toEqual({
      error: '存在 1 个数据库 schema 门禁未满足',
      releaseId: 'release-1',
      releasePath: '/projects/project-1/environments/env-1/delivery/release-1',
      release: {
        id: 'release-1',
        projectId: 'project-1',
        environmentId: 'env-1',
        status: 'admission_failed',
        releasePath: '/projects/project-1/environments/env-1/delivery/release-1',
      },
    });
  });

  it('preserves explicit preview guard release paths', () => {
    const payload = getAdmissionFailureResponsePayload(
      new PreviewDatabaseGuardBlockedError(
        {
          canCreate: false,
          summary: 'Preview DB guard failed',
          blockingReason: '预览库继承策略禁止创建发布',
          nextActionLabel: '调整预览数据库策略',
          customSignals: [],
        },
        undefined,
        {
          ...admissionRelease,
          releasePath: '/custom-release-path',
        }
      )
    );

    expect(payload?.releasePath).toBe('/custom-release-path');
    expect(payload?.release?.releasePath).toBe('/custom-release-path');
  });
});
