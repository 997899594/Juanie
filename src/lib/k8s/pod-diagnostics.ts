import type * as k8s from '@kubernetes/client-node';

export function getContainerWaitingMessage(containerStatus?: k8s.V1ContainerStatus): string | null {
  const waiting = containerStatus?.state?.waiting;
  if (!waiting) {
    return null;
  }

  return waiting.message
    ? `${waiting.reason ?? 'Waiting'}: ${waiting.message}`
    : (waiting.reason ?? 'Waiting');
}

export function getContainerTerminatedMessage(
  containerStatus?: k8s.V1ContainerStatus
): string | null {
  const terminated = containerStatus?.state?.terminated;
  if (!terminated) {
    return null;
  }

  return terminated.message
    ? `${terminated.reason ?? 'Terminated'}: ${terminated.message}`
    : (terminated.reason ?? 'Terminated');
}

export function describeDeploymentPodIssues(pods: k8s.V1Pod[]): string | null {
  for (const pod of pods) {
    const statuses = pod.status?.containerStatuses ?? [];

    for (const status of statuses) {
      const waitingMessage = getContainerWaitingMessage(status);
      if (
        waitingMessage &&
        ['ImagePullBackOff', 'ErrImagePull', 'CrashLoopBackOff', 'CreateContainerConfigError'].some(
          (reason) => waitingMessage.includes(reason)
        )
      ) {
        return `${pod.metadata?.name ?? 'pod'} · ${waitingMessage}`;
      }

      const terminatedMessage = getContainerTerminatedMessage(status);
      if (terminatedMessage) {
        return `${pod.metadata?.name ?? 'pod'} · ${terminatedMessage}`;
      }
    }
  }

  return null;
}

export function getEventTimestamp(event: k8s.CoreV1Event): number {
  const timestamp = event.eventTime ?? event.lastTimestamp ?? event.firstTimestamp;
  if (!timestamp) {
    return 0;
  }

  const value = new Date(timestamp).getTime();
  return Number.isNaN(value) ? 0 : value;
}

export function formatPodWarningEvent(event: k8s.CoreV1Event): string {
  const reason = event.reason ?? 'Warning';
  if (!event.message) {
    return reason;
  }

  return `${reason}: ${event.message}`;
}

export function isReadinessWarning(event: k8s.CoreV1Event): boolean {
  const reason = event.reason ?? '';
  const message = event.message ?? '';
  const text = `${reason} ${message}`;
  return [
    'Unhealthy',
    'Readiness probe failed',
    'Liveness probe failed',
    'Startup probe failed',
    'Back-off restarting failed container',
  ].some((keyword) => text.includes(keyword));
}

export function getPodStatusMessage(pod: k8s.V1Pod): string | null {
  const statuses = [
    ...(pod.status?.initContainerStatuses ?? []),
    ...(pod.status?.containerStatuses ?? []),
  ];

  for (const status of statuses) {
    const waitingMessage = getContainerWaitingMessage(status);
    if (waitingMessage) {
      return waitingMessage;
    }

    const terminatedMessage = getContainerTerminatedMessage(status);
    if (terminatedMessage) {
      return terminatedMessage;
    }
  }

  return pod.status?.message ?? pod.status?.reason ?? null;
}
