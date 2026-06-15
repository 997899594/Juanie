import { describe, expect, it } from 'bun:test';
import type * as k8s from '@kubernetes/client-node';
import {
  collectDeploymentPodIssues,
  describeDeploymentPodIssues,
  formatDeploymentPodIssue,
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
      'web-7d9f · container waiting: ImagePullBackOff: back-off pulling image'
    );
  });

  it('容器退出时返回容器名、退出原因和退出码', () => {
    const pods = [
      {
        metadata: { name: 'worker-0' },
        status: {
          containerStatuses: [
            {
              name: 'app',
              restartCount: 0,
              state: {
                terminated: {
                  reason: 'Error',
                  message: 'command failed',
                  exitCode: 1,
                },
              },
            },
          ],
        },
      },
    ] as k8s.V1Pod[];

    expect(describeDeploymentPodIssues(pods)).toBe(
      'worker-0 · app terminated: Error: command failed (exit code 1, restarts 0)'
    );
  });

  it('容器退出但 Kubernetes 没有 termination message 时不降级成裸 Error', () => {
    const pods = [
      {
        metadata: { name: 'nexusnote-uclhhb-worker-5cbc87474f-2848g' },
        status: {
          containerStatuses: [
            {
              name: 'app',
              restartCount: 0,
              state: {
                terminated: {
                  reason: 'Error',
                  exitCode: 1,
                },
              },
            },
          ],
        },
      },
    ] as k8s.V1Pod[];

    expect(describeDeploymentPodIssues(pods)).toBe(
      'nexusnote-uclhhb-worker-5cbc87474f-2848g · app terminated: Error (exit code 1, restarts 0)'
    );
  });

  it('CrashLoopBackOff 时保留上一次退出原因', () => {
    const pods = [
      {
        metadata: { name: 'worker-0' },
        status: {
          containerStatuses: [
            {
              name: 'app',
              restartCount: 3,
              state: {
                waiting: {
                  reason: 'CrashLoopBackOff',
                  message: 'back-off restarting failed container',
                },
              },
              lastState: {
                terminated: {
                  reason: 'Error',
                  exitCode: 1,
                },
              },
            },
          ],
        },
      },
    ] as k8s.V1Pod[];

    const issue = collectDeploymentPodIssues(pods)[0]!;

    expect(issue.lastTerminationExitCode).toBe(1);
    expect(formatDeploymentPodIssue(issue)).toBe(
      'worker-0 · app waiting: CrashLoopBackOff: back-off restarting failed container (restarts 3, last exit code 1, last reason Error)'
    );
  });

  it('Pod 状态消息优先读取 initContainer 的等待态再读取业务容器', () => {
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

  it('Pod 状态消息忽略成功退出的 initContainer', () => {
    const pod = {
      status: {
        initContainerStatuses: [
          {
            state: {
              terminated: {
                exitCode: 0,
                reason: 'Completed',
              },
            },
          },
        ],
        containerStatuses: [
          {
            state: {
              running: {},
            },
          },
        ],
      },
    } as k8s.V1Pod;

    expect(getPodStatusMessage(pod)).toBe(null);
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
