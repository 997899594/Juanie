import { describe, expect, it } from 'bun:test';
import {
  buildPreviewLaunchMissingRefMessage,
  buildPreviewLaunchRef,
  collectReusableReleaseServices,
} from '@/lib/environments/preview-launch';

describe('preview launch artifact reuse', () => {
  it('reuses same-sha artifacts when every current service has an image', () => {
    const services = collectReusableReleaseServices({
      projectServices: [
        { id: 'svc_web', name: 'web' },
        { id: 'svc_worker', name: 'worker' },
      ],
      releasesForCommit: [
        {
          artifacts: [
            {
              serviceId: 'svc_worker',
              imageUrl: 'registry.example.com/acme/juanie/worker:sha-abc1234',
              service: {
                id: 'svc_worker',
                name: 'worker',
              },
            },
          ],
        },
        {
          artifacts: [
            {
              serviceId: 'svc_web',
              imageUrl: 'registry.example.com/acme/juanie/web:sha-abc1234',
              service: {
                id: 'svc_web',
                name: 'web',
              },
            },
          ],
        },
      ],
    });

    expect(services).toEqual([
      {
        id: 'svc_web',
        name: 'web',
        image: 'registry.example.com/acme/juanie/web:sha-abc1234',
      },
      {
        id: 'svc_worker',
        name: 'worker',
        image: 'registry.example.com/acme/juanie/worker:sha-abc1234',
      },
    ]);
  });

  it('returns null when any current service is missing a same-sha artifact', () => {
    const services = collectReusableReleaseServices({
      projectServices: [
        { id: 'svc_web', name: 'web' },
        { id: 'svc_worker', name: 'worker' },
      ],
      releasesForCommit: [
        {
          artifacts: [
            {
              serviceId: 'svc_web',
              imageUrl: 'registry.example.com/acme/juanie/web:sha-abc1234',
              service: {
                id: 'svc_web',
                name: 'web',
              },
            },
          ],
        },
      ],
    });

    expect(services).toBe(null);
  });

  it('normalizes branch and PR launch refs', () => {
    expect(buildPreviewLaunchRef({ branch: 'codex/evidence-event-knowledge-os' })).toBe(
      'refs/heads/codex/evidence-event-knowledge-os'
    );
    expect(buildPreviewLaunchRef({ branch: 'refs/heads/codex/evidence-event-knowledge-os' })).toBe(
      'refs/heads/codex/evidence-event-knowledge-os'
    );
    expect(buildPreviewLaunchRef({ prNumber: 42 })).toBe('refs/pull/42/merge');
  });

  it('builds precise missing-ref messages for branches and PRs', () => {
    expect(
      buildPreviewLaunchMissingRefMessage('refs/heads/codex/evidence-event-knowledge-os')
    ).toContain('已经 push 到仓库远端');
    expect(buildPreviewLaunchMissingRefMessage('refs/pull/42/merge')).toContain('PR / MR #42');
  });
});
