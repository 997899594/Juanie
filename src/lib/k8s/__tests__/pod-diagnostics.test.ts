import { describe, expect, it } from 'bun:test';
import type * as k8s from '@kubernetes/client-node';
import {
  describeDeploymentPodIssues,
  formatPodWarningEvent,
  getEventTimestamp,
  getPodStatusMessage,
  isReadinessWarning,
} from '@/lib/k8s/pod-diagnostics';

describe('kubernetes pod diagnostics', () => {
  it('优先返回会阻断部署就绪的容器等待原因', () => {
    const pods = [
      {
        metadata: { name: 'web-7d9f' },
        status: {
          containerStatuses: [
            {
              state: {
                waiting: {
                  reason: 'ImagePullBackOff',
                  message: 'back-off pulling image',
                },
              },
            },
          ],
        },
      },
    ] as k8s.V1Pod[];

    expect(describeDeploymentPodIssues(pods)).toBe(
      'web-7d9f · ImagePullBackOff: back-off pulling image'
    );
  });

  it('容器退出时返回退出原因', () => {
    const pods = [
      {
        metadata: { name: 'worker-0' },
        status: {
          containerStatuses: [
            {
              state: {
                terminated: {
                  reason: 'Error',
                  message: 'command failed',
                },
              },
            },
          ],
        },
      },
    ] as k8s.V1Pod[];

    expect(describeDeploymentPodIssues(pods)).toBe('worker-0 · Error: command failed');
  });

  it('Pod 状态消息优先读取 initContainer 再读取业务容器', () => {
    const pod = {
      status: {
        initContainerStatuses: [
          {
            state: {
              waiting: {
                reason: 'CreateContainerConfigError',
                message: 'missing secret',
              },
            },
          },
        ],
        containerStatuses: [
          {
            state: {
              waiting: {
                reason: 'Running',
              },
            },
          },
        ],
      },
    } as k8s.V1Pod;

    expect(getPodStatusMessage(pod)).toBe('CreateContainerConfigError: missing secret');
  });

  it('格式化事件并识别探针类告警', () => {
    const event = {
      metadata: {},
      involvedObject: { kind: 'Pod', name: 'web-7d9f' },
      reason: 'Unhealthy',
      message: 'Readiness probe failed: connection refused',
      lastTimestamp: new Date('2026-04-29T10:00:00.000Z'),
    } as k8s.CoreV1Event;

    expect(formatPodWarningEvent(event)).toBe(
      'Unhealthy: Readiness probe failed: connection refused'
    );
    expect(isReadinessWarning(event)).toBe(true);
    expect(getEventTimestamp(event)).toBe(new Date('2026-04-29T10:00:00.000Z').getTime());
  });
});
