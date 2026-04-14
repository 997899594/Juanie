import { describe, expect, it } from 'bun:test';
import { collectReusableReleaseServices } from '@/lib/environments/preview-launch';

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
});
