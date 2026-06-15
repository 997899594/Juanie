import { describe, expect, it } from 'bun:test';
import { getActionableRolloutDeployments } from '@/components/projects/ReleaseDetailSections';

describe('release detail sections', () => {
  const rolloutDeployment = {
    id: 'dep-web',
    status: 'awaiting_rollout',
    serviceId: 'svc-web',
    version: null,
    imageUrl: 'ghcr.io/demo/web:sha',
    errorMessage: null,
    statusDecoration: {
      color: 'warning' as const,
      pulse: false,
      label: '待放量',
    },
    serviceName: 'web',
  };

  it('does not expose rollout actions after the release has failed', () => {
    expect(
      getActionableRolloutDeployments({
        status: 'failed',
        deploymentItems: [rolloutDeployment],
      })
    ).toEqual([]);
  });

  it('exposes rollout actions only while the release is awaiting rollout', () => {
    expect(
      getActionableRolloutDeployments({
        status: 'awaiting_rollout',
        deploymentItems: [
          rolloutDeployment,
          { ...rolloutDeployment, id: 'dep-running', status: 'running' },
        ],
      })
    ).toEqual([rolloutDeployment]);
  });
});
