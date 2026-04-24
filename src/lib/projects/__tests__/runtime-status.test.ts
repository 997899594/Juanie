import { describe, expect, it } from 'bun:test';
import { resolveProjectRuntimeStatus } from '@/lib/projects/runtime-status';

describe('project runtime status', () => {
  it('surfaces direct-environment first build failures as project failures', () => {
    const snapshot = resolveProjectRuntimeStatus({
      status: 'active',
      environments: [
        {
          name: 'staging',
          isPreview: false,
          deliveryMode: 'direct',
          previewBuildStatus: 'failed',
        },
      ],
    });

    expect(snapshot.status).toBe('failed');
    expect(snapshot.statusLabel).toBe('首发构建失败');
    expect(snapshot.bootstrapEnvironmentName).toBe('staging');
  });

  it('keeps preview-only build failures from downgrading the project runtime state', () => {
    const snapshot = resolveProjectRuntimeStatus({
      status: 'active',
      environments: [
        {
          name: 'preview/main',
          isPreview: true,
          deliveryMode: 'direct',
          previewBuildStatus: 'failed',
        },
      ],
    });

    expect(snapshot.status).toBe('active');
    expect(snapshot.statusLabel).toBe('运行中');
    expect(snapshot.bootstrapEnvironmentName).toBe(null);
  });

  it('surfaces in-flight first builds as initializing even after infra is active', () => {
    const snapshot = resolveProjectRuntimeStatus({
      status: 'active',
      environments: [
        {
          name: 'staging',
          isPreview: false,
          deliveryMode: 'direct',
          previewBuildStatus: 'building',
        },
      ],
    });

    expect(snapshot.status).toBe('initializing');
    expect(snapshot.statusLabel).toBe('首发构建中');
  });
});
