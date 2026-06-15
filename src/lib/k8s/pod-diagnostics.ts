import type * as k8s from '@kubernetes/client-node';

const BLOCKING_WAITING_REASONS = new Set([
  'ImagePullBackOff',
  'ErrImagePull',
  'CrashLoopBackOff',
  'CreateContainerConfigError',
  'CreateContainerError',
  'RunContainerError',
  'InvalidImageName',
]);

export interface DeploymentPodIssue {
  podName: string;
  containerName: string;
  containerStatus: k8s.V1ContainerStatus;
  state: 'waiting' | 'terminated';
  reason: string;
  message: string | null;
  exitCode: number | null;
  signal: number | null;
  restartCount: number | null;
  lastTerminationReason: string | null;
  lastTerminationExitCode: number | null;
}

function formatReasonWithMessage(reason: string | undefined, message: string | undefined): string {
  const fallbackReason = reason ?? 'Unknown';
  return message ? `${fallbackReason}: ${message}` : fallbackReason;
}

export function getContainerWaitingMessage(containerStatus?: k8s.V1ContainerStatus): string | null {
  const waiting = containerStatus?.state?.waiting;
  if (!waiting) {
    return null;
  }

  return formatReasonWithMessage(waiting.reason ?? 'Waiting', waiting.message);
}

export function getContainerTerminatedMessage(
  containerStatus?: k8s.V1ContainerStatus
): string | null {
  const terminated = containerStatus?.state?.terminated;
  if (!terminated) {
    return null;
  }

  if (terminated.exitCode === 0) {
    return null;
  }

  return formatReasonWithMessage(terminated.reason ?? 'Terminated', terminated.message);
}

function isBlockingWaitingMessage(message: string): boolean {
  return Array.from(BLOCKING_WAITING_REASONS).some((reason) => message.includes(reason));
}

function getContainerStatuses(pod: k8s.V1Pod): k8s.V1ContainerStatus[] {
  return [...(pod.status?.initContainerStatuses ?? []), ...(pod.status?.containerStatuses ?? [])];
}

export function collectDeploymentPodIssues(pods: k8s.V1Pod[]): DeploymentPodIssue[] {
  const issues: DeploymentPodIssue[] = [];

  for (const pod of pods) {
    const podName = pod.metadata?.name ?? 'pod';
    const statuses = getContainerStatuses(pod);

    for (const status of statuses) {
      const waitingMessage = getContainerWaitingMessage(status);
      if (waitingMessage && isBlockingWaitingMessage(waitingMessage)) {
        const lastTermination = status.lastState?.terminated ?? null;
        issues.push({
          podName,
          containerName: status.name ?? 'container',
          containerStatus: status,
          state: 'waiting',
          reason: status.state?.waiting?.reason ?? 'Waiting',
          message: status.state?.waiting?.message ?? null,
          exitCode: null,
          signal: null,
          restartCount: status.restartCount ?? null,
          lastTerminationReason: lastTermination?.reason ?? null,
          lastTerminationExitCode: lastTermination?.exitCode ?? null,
        });
        continue;
      }

      const terminatedMessage = getContainerTerminatedMessage(status);
      if (terminatedMessage) {
        const terminated = status.state?.terminated;
        issues.push({
          podName,
          containerName: status.name ?? 'container',
          containerStatus: status,
          state: 'terminated',
          reason: terminated?.reason ?? 'Terminated',
          message: terminated?.message ?? null,
          exitCode: terminated?.exitCode ?? null,
          signal: terminated?.signal ?? null,
          restartCount: status.restartCount ?? null,
          lastTerminationReason: null,
          lastTerminationExitCode: null,
        });
      }
    }
  }

  return issues;
}

export function formatDeploymentPodIssue(issue: DeploymentPodIssue): string {
  const details: string[] = [];

  if (issue.exitCode !== null) {
    details.push(`exit code ${issue.exitCode}`);
  }

  if (issue.signal !== null && issue.signal > 0) {
    details.push(`signal ${issue.signal}`);
  }

  if (issue.restartCount !== null) {
    details.push(`restarts ${issue.restartCount}`);
  }

  if (issue.lastTerminationExitCode !== null) {
    details.push(`last exit code ${issue.lastTerminationExitCode}`);
  }

  if (issue.lastTerminationReason) {
    details.push(`last reason ${issue.lastTerminationReason}`);
  }

  const reason = formatReasonWithMessage(issue.reason, issue.message ?? undefined);
  const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';
  return `${issue.podName} · ${issue.containerName} ${issue.state}: ${reason}${suffix}`;
}

export function describeDeploymentPodIssues(pods: k8s.V1Pod[]): string | null {
  const issue = collectDeploymentPodIssues(pods)[0];
  return issue ? formatDeploymentPodIssue(issue) : null;
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
