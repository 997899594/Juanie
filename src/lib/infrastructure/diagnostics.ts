import type * as k8s from '@kubernetes/client-node';
import type { EnvironmentDeploymentStrategy, ServiceType } from '@/lib/db/schema';
import { getDeployments, getEvents, getNodes, getPods, getPodsAllNamespaces } from '@/lib/k8s';
import type { PlatformSignalChip } from '@/lib/signals/platform';

const INCIDENT_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const RELEASE_WINDOW_SLACK_MS = 15 * 60 * 1000;
const STUCK_TERMINATING_THRESHOLD_MS = 10 * 60 * 1000;
const LONG_PENDING_THRESHOLD_MS = 10 * 60 * 1000;
const DEFAULT_PLATFORM_NAMESPACE = process.env.PLATFORM_NAMESPACE?.trim() || 'juanie';

type DiagnosticsTone = 'info' | 'warning' | 'danger';

export type InfrastructureIssueCode =
  | 'capacity_blocked'
  | 'image_pull_stalled'
  | 'probe_failed'
  | 'rollout_deadline_exceeded'
  | 'runtime_unhealthy'
  | 'stuck_terminating_pods';

export interface InfrastructureDesiredWorkload {
  id?: string;
  name: string;
  type?: ServiceType | null;
  replicas?: number | null;
  cpuRequest?: string | null;
  memoryRequest?: string | null;
}

export interface InfrastructureDiagnosticsInput {
  namespace: string;
  deploymentStrategy?: EnvironmentDeploymentStrategy | null;
  workloads?: InfrastructureDesiredWorkload[] | null;
  releaseWindow?: {
    startedAt?: Date | string | null;
    finishedAt?: Date | string | null;
  } | null;
  platformNamespace?: string | null;
}

export interface InfrastructurePrimaryIssue {
  code: InfrastructureIssueCode;
  label: string;
  summary: string;
  nextActionLabel: string;
}

export interface InfrastructureIncident {
  key: string;
  at: string | null;
  timestamp: string | null;
  title: string;
  description: string;
  tone: DiagnosticsTone;
  issueCode: InfrastructureIssueCode;
}

export interface InfrastructureResourceBucket {
  count: number;
  names: string[];
  label: string;
}

export interface InfrastructureCapacitySnapshot {
  nodeCount: number;
  allocatableMemoryMi: number | null;
  requestedMemoryMi: number | null;
  availableMemoryMi: number | null;
  saturationPercent: number | null;
  saturationLabel: string | null;
  allocatableMemoryLabel: string;
  requestedMemoryLabel: string;
  availableMemoryLabel: string;
  platformRequestedMemoryMi: number | null;
  platformRequestedMemoryLabel: string;
  environmentRequestedMemoryMi: number | null;
  environmentRequestedMemoryLabel: string;
  estimatedRolloutDeltaMemoryMi: number | null;
  estimatedRolloutDeltaMemoryLabel: string;
}

export interface InfrastructureAbnormalResources {
  namespacePendingPods: InfrastructureResourceBucket;
  namespaceCrashLoopPods: InfrastructureResourceBucket;
  namespaceImagePullPods: InfrastructureResourceBucket;
  namespaceOOMKilledPods: InfrastructureResourceBucket;
  clusterTerminatingPods: InfrastructureResourceBucket;
  clusterLongPendingPods: InfrastructureResourceBucket;
}

export interface InfrastructureDiagnosticsSnapshot {
  available: boolean;
  namespace: string;
  primaryIssue: InfrastructurePrimaryIssue | null;
  summary: string | null;
  nextActionLabel: string | null;
  recommendations: Array<{
    key: string;
    label: string;
    summary: string;
  }>;
  signalChips: PlatformSignalChip[];
  incidents: InfrastructureIncident[];
  capacity: InfrastructureCapacitySnapshot;
  abnormalResources: InfrastructureAbnormalResources;
}

interface EventIssue {
  code: InfrastructureIssueCode;
  title: string;
  description: string;
  tone: DiagnosticsTone;
  key: string;
  timestamp: Date | null;
}

interface PodIssue {
  code: InfrastructureIssueCode;
  title: string;
  description: string;
  tone: DiagnosticsTone;
  key: string;
  timestamp: Date | null;
}

function safeDate(value?: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(value?: Date | string | null): string | null {
  const date = safeDate(value);
  return date ? date.toISOString() : null;
}

function createBucket(label: string, names: string[]): InfrastructureResourceBucket {
  return {
    count: names.length,
    names,
    label: names.length > 0 ? `${names.length} 个${label}` : `无${label}`,
  };
}

function roundMetric(value: number): number {
  return value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
}

function formatMemoryMi(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  if (value >= 1024) {
    return `${roundMetric(value / 1024)} Gi`;
  }

  return `${roundMetric(value)} Mi`;
}

function formatPercent(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value)}%`;
}

function parseMemoryToMi(value?: string | null): number {
  if (!value) {
    return 0;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^([0-9]*\.?[0-9]+)\s*([a-zA-Z]+)?$/);
  if (!match) {
    return 0;
  }

  const amount = Number.parseFloat(match[1] ?? '0');
  const unit = match[2] ?? '';
  if (!Number.isFinite(amount)) {
    return 0;
  }

  switch (unit) {
    case '':
      return amount / (1024 * 1024);
    case 'Ki':
      return amount / 1024;
    case 'Mi':
      return amount;
    case 'Gi':
      return amount * 1024;
    case 'Ti':
      return amount * 1024 * 1024;
    case 'K':
      return (amount * 1000) / (1024 * 1024);
    case 'M':
      return (amount * 1000 * 1000) / (1024 * 1024);
    case 'G':
      return (amount * 1000 * 1000 * 1000) / (1024 * 1024);
    default:
      return 0;
  }
}

function getPodRequestedMemoryMi(pod: k8s.V1Pod): number {
  const regularContainers = pod.spec?.containers ?? [];
  const initContainers = pod.spec?.initContainers ?? [];

  const regularTotal = regularContainers.reduce(
    (sum, container) => sum + parseMemoryToMi(container.resources?.requests?.memory),
    0
  );
  const initMax = initContainers.reduce(
    (max, container) => Math.max(max, parseMemoryToMi(container.resources?.requests?.memory)),
    0
  );

  return Math.max(regularTotal, initMax);
}

function getDeploymentRequestedMemoryMi(deployment: k8s.V1Deployment): number {
  const containers = deployment.spec?.template?.spec?.containers ?? [];
  const initContainers = deployment.spec?.template?.spec?.initContainers ?? [];
  const replicas = deployment.spec?.replicas ?? 1;
  const regularTotal = containers.reduce(
    (sum, container) => sum + parseMemoryToMi(container.resources?.requests?.memory),
    0
  );
  const initMax = initContainers.reduce(
    (max, container) => Math.max(max, parseMemoryToMi(container.resources?.requests?.memory)),
    0
  );

  return Math.max(regularTotal, initMax) * replicas;
}

function getNodeAllocatableMemoryMi(node: k8s.V1Node): number {
  return parseMemoryToMi(node.status?.allocatable?.memory);
}

function getEventTime(event: k8s.CoreV1Event): Date | null {
  return (
    safeDate((event as { eventTime?: Date | string | null }).eventTime) ??
    safeDate((event as { lastTimestamp?: Date | string | null }).lastTimestamp) ??
    safeDate((event as { firstTimestamp?: Date | string | null }).firstTimestamp) ??
    safeDate(event.metadata?.creationTimestamp)
  );
}

function toTitleCaseReason(reason?: string | null): string {
  return reason && reason.length > 0 ? reason : '异常';
}

function describeEvent(event: k8s.CoreV1Event): EventIssue | null {
  const reason = event.reason ?? '';
  const message = event.message?.trim() ?? '';
  const involved = event.involvedObject?.name ?? '资源';
  const timestamp = getEventTime(event);
  const normalized = `${reason} ${message}`.toLowerCase();

  if (reason === 'FailedScheduling' || normalized.includes('insufficient')) {
    return {
      code: 'capacity_blocked',
      title: '调度失败',
      description: `${involved} · ${message || '节点容量不足，无法调度新 Pod'}`,
      tone: 'danger',
      key: `event:capacity:${event.metadata?.uid ?? involved}:${message}`,
      timestamp,
    };
  }

  if (
    normalized.includes('errimagepull') ||
    normalized.includes('imagepullbackoff') ||
    normalized.includes('failed to pull image') ||
    normalized.includes('back-off pulling image')
  ) {
    return {
      code: 'image_pull_stalled',
      title: '镜像拉取异常',
      description: `${involved} · ${message || '镜像拉取失败或卡住'}`,
      tone: 'danger',
      key: `event:image:${event.metadata?.uid ?? involved}:${message}`,
      timestamp,
    };
  }

  if (reason === 'Unhealthy' || normalized.includes('probe failed')) {
    return {
      code: 'probe_failed',
      title: '探针失败',
      description: `${involved} · ${message || '就绪或存活探针没有通过'}`,
      tone: 'warning',
      key: `event:probe:${event.metadata?.uid ?? involved}:${message}`,
      timestamp,
    };
  }

  if (reason === 'ProgressDeadlineExceeded' || normalized.includes('progressdeadlineexceeded')) {
    return {
      code: 'rollout_deadline_exceeded',
      title: 'Rollout 超时',
      description: `${involved} · ${message || '部署在 progress deadline 内没有完成'}`,
      tone: 'danger',
      key: `event:deadline:${event.metadata?.uid ?? involved}:${message}`,
      timestamp,
    };
  }

  if (reason === 'BackOff' && !normalized.includes('pulling image')) {
    return {
      code: 'runtime_unhealthy',
      title: '容器反复重启',
      description: `${involved} · ${message || '容器进入 BackOff'}`,
      tone: 'warning',
      key: `event:runtime:${event.metadata?.uid ?? involved}:${message}`,
      timestamp,
    };
  }

  return null;
}

function describePodIssues(pods: k8s.V1Pod[]): PodIssue[] {
  const issues: PodIssue[] = [];

  for (const pod of pods) {
    const podName = pod.metadata?.name ?? 'pod';
    const timestamp = safeDate(pod.metadata?.creationTimestamp);
    const containerStatuses = pod.status?.containerStatuses ?? [];

    for (const status of containerStatuses) {
      const waitingReason = status.state?.waiting?.reason ?? null;
      const waitingMessage = status.state?.waiting?.message ?? null;
      const terminatedReason =
        status.state?.terminated?.reason ?? status.lastState?.terminated?.reason ?? null;

      if (waitingReason === 'CrashLoopBackOff') {
        issues.push({
          code: 'runtime_unhealthy',
          title: 'CrashLoopBackOff',
          description: `${podName} · ${status.name} 容器反复启动失败${waitingMessage ? ` · ${waitingMessage}` : ''}`,
          tone: 'danger',
          key: `pod:crashloop:${pod.metadata?.uid ?? podName}:${status.name}`,
          timestamp,
        });
      }

      if (waitingReason === 'ImagePullBackOff' || waitingReason === 'ErrImagePull') {
        issues.push({
          code: 'image_pull_stalled',
          title: toTitleCaseReason(waitingReason),
          description: `${podName} · ${status.name} 无法拉取镜像${waitingMessage ? ` · ${waitingMessage}` : ''}`,
          tone: 'danger',
          key: `pod:image:${pod.metadata?.uid ?? podName}:${status.name}:${waitingReason}`,
          timestamp,
        });
      }

      if (terminatedReason === 'OOMKilled') {
        issues.push({
          code: 'runtime_unhealthy',
          title: 'OOMKilled',
          description: `${podName} · ${status.name} 因内存不足被系统终止`,
          tone: 'danger',
          key: `pod:oom:${pod.metadata?.uid ?? podName}:${status.name}`,
          timestamp,
        });
      }
    }
  }

  return issues;
}

function describeDeploymentIssues(deployments: k8s.V1Deployment[]): PodIssue[] {
  const issues: PodIssue[] = [];

  for (const deployment of deployments) {
    const condition = deployment.status?.conditions?.find(
      (item) =>
        item.reason === 'ProgressDeadlineExceeded' ||
        (item.type === 'Progressing' && item.status === 'False')
    );

    if (!condition) {
      continue;
    }

    const deploymentName = deployment.metadata?.name ?? 'deployment';
    issues.push({
      code: 'rollout_deadline_exceeded',
      title: 'Rollout 超时',
      description: `${deploymentName} · ${condition.message ?? '部署未在 deadline 内就绪'}`,
      tone: 'danger',
      key: `deployment:deadline:${deployment.metadata?.uid ?? deploymentName}`,
      timestamp: safeDate(condition.lastUpdateTime ?? condition.lastTransitionTime),
    });
  }

  return issues;
}

function computeReleaseWindow(input?: InfrastructureDiagnosticsInput['releaseWindow']): {
  start: number;
  end: number;
} {
  const now = Date.now();
  const startAt = safeDate(input?.startedAt);
  const endAt = safeDate(input?.finishedAt);

  return {
    start: startAt ? startAt.getTime() - RELEASE_WINDOW_SLACK_MS : now - INCIDENT_LOOKBACK_MS,
    end: endAt ? endAt.getTime() + RELEASE_WINDOW_SLACK_MS : now,
  };
}

function withinWindow(timestamp: Date | null, window: { start: number; end: number }): boolean {
  if (!timestamp) {
    return true;
  }

  const value = timestamp.getTime();
  return value >= window.start && value <= window.end;
}

function dedupeIncidents(
  incidents: Array<EventIssue | PodIssue>,
  window: { start: number; end: number }
): InfrastructureIncident[] {
  const seen = new Set<string>();

  return incidents
    .filter((incident) => withinWindow(incident.timestamp, window))
    .sort((left, right) => {
      const leftValue = left.timestamp?.getTime() ?? 0;
      const rightValue = right.timestamp?.getTime() ?? 0;
      return leftValue - rightValue;
    })
    .filter((incident) => {
      if (seen.has(incident.key)) {
        return false;
      }

      seen.add(incident.key);
      return true;
    })
    .slice(-8)
    .map((incident) => ({
      key: incident.key,
      at: formatTimestamp(incident.timestamp),
      timestamp: formatTimestamp(incident.timestamp),
      title: incident.title,
      description: incident.description,
      tone: incident.tone,
      issueCode: incident.code,
    }));
}

function buildIssueSnapshot(
  code: InfrastructureIssueCode,
  input: {
    incidents: InfrastructureIncident[];
    abnormalResources: InfrastructureAbnormalResources;
    capacity: InfrastructureCapacitySnapshot;
  }
): InfrastructurePrimaryIssue {
  switch (code) {
    case 'capacity_blocked':
      return {
        code,
        label: '调度不足',
        summary:
          input.incidents.find((incident) => incident.issueCode === code)?.description ??
          `集群当前已请求 ${input.capacity.requestedMemoryLabel} 内存，可分配剩余 ${input.capacity.availableMemoryLabel}，新的 Pod 无法调度`,
        nextActionLabel: '释放节点容量，或降低这次发布的资源请求',
      };
    case 'image_pull_stalled':
      return {
        code,
        label: '镜像拉取失败',
        summary:
          input.incidents.find((incident) => incident.issueCode === code)?.description ??
          'Pod 无法从镜像仓库拉取新镜像，发布停在镜像分发阶段',
        nextActionLabel: '检查镜像地址、拉取凭证和节点网络',
      };
    case 'probe_failed':
      return {
        code,
        label: '探针失败',
        summary:
          input.incidents.find((incident) => incident.issueCode === code)?.description ??
          '新版本启动后没有通过 readiness / liveness 探针',
        nextActionLabel: '检查应用启动耗时、探针路径与健康检查逻辑',
      };
    case 'rollout_deadline_exceeded':
      return {
        code,
        label: 'Rollout 超时',
        summary:
          input.incidents.find((incident) => incident.issueCode === code)?.description ??
          'Deployment 在 progress deadline 内没有完成更新',
        nextActionLabel: '查看 Deployment 条件、Pod 状态与基础设施事件',
      };
    case 'runtime_unhealthy':
      return {
        code,
        label: '运行时异常',
        summary:
          input.incidents.find((incident) => incident.issueCode === code)?.description ??
          '容器出现 CrashLoopBackOff、OOMKilled 或持续重启',
        nextActionLabel: '先看环境日志，再检查资源限制和启动流程',
      };
    case 'stuck_terminating_pods':
      return {
        code,
        label: '异常残留资源',
        summary: `${input.abnormalResources.clusterTerminatingPods.label} 持续未释放，正在挤占集群调度位`,
        nextActionLabel: '清理长时间 Terminating 的残留 Pod',
      };
  }
}

function buildSignalChips(input: {
  primaryIssue: InfrastructurePrimaryIssue | null;
  abnormalResources: InfrastructureAbnormalResources;
}): PlatformSignalChip[] {
  const chips: PlatformSignalChip[] = [];

  if (input.primaryIssue) {
    chips.push({
      key: `infra:${input.primaryIssue.code}`,
      label: input.primaryIssue.label,
      tone: 'danger',
    });
  }

  if (input.abnormalResources.clusterTerminatingPods.count > 0) {
    chips.push({
      key: 'infra:stuck_terminating_pods',
      label: '残留资源未释放',
      tone: input.primaryIssue?.code === 'stuck_terminating_pods' ? 'danger' : 'neutral',
    });
  }

  if (input.abnormalResources.namespaceImagePullPods.count > 0) {
    chips.push({
      key: 'infra:image_pull_stalled',
      label: '镜像拉取异常',
      tone: input.primaryIssue?.code === 'image_pull_stalled' ? 'danger' : 'neutral',
    });
  }

  if (
    input.abnormalResources.namespaceCrashLoopPods.count > 0 ||
    input.abnormalResources.namespaceOOMKilledPods.count > 0
  ) {
    chips.push({
      key: 'infra:runtime_unhealthy',
      label: '运行时不健康',
      tone: input.primaryIssue?.code === 'runtime_unhealthy' ? 'danger' : 'neutral',
    });
  }

  if (input.abnormalResources.namespacePendingPods.count > 0) {
    chips.push({
      key: 'infra:pending_pods',
      label: '存在 Pending Pod',
      tone: input.primaryIssue?.code === 'capacity_blocked' ? 'danger' : 'neutral',
    });
  }

  return chips;
}

function sumRequestedMemory(pods: k8s.V1Pod[]): number {
  return pods.reduce((sum, pod) => sum + getPodRequestedMemoryMi(pod), 0);
}

function estimateRolloutDeltaMemoryMi(
  workloads: InfrastructureDesiredWorkload[],
  deployments: k8s.V1Deployment[],
  deploymentStrategy?: EnvironmentDeploymentStrategy | null
): number | null {
  const normalizedWorkloads =
    workloads.length > 0
      ? workloads.filter((workload) => workload.type !== 'cron')
      : deployments.map((deployment) => ({
          name: deployment.metadata?.name ?? 'service',
          replicas: deployment.spec?.replicas ?? 1,
          memoryRequest: `${getDeploymentRequestedMemoryMi(deployment)}Mi`,
        }));

  if (normalizedWorkloads.length === 0) {
    return null;
  }

  const perReplicaMemory = normalizedWorkloads.reduce((sum, workload) => {
    const replicas = Math.max(workload.replicas ?? 1, 1);
    const totalMemory = parseMemoryToMi(workload.memoryRequest);
    const singleReplicaMemory = totalMemory > 0 ? totalMemory : 0;

    if (deploymentStrategy === 'blue_green') {
      return sum + singleReplicaMemory * replicas;
    }

    if (deploymentStrategy === 'canary') {
      return sum + singleReplicaMemory * Math.max(Math.ceil(replicas * 0.25), 1);
    }

    if (deploymentStrategy === 'controlled') {
      return sum + singleReplicaMemory;
    }

    return sum;
  }, 0);

  if (deploymentStrategy === 'rolling' || !deploymentStrategy) {
    return 0;
  }

  return perReplicaMemory;
}

function buildCapacitySnapshot(input: {
  nodes: k8s.V1Node[];
  allPods: k8s.V1Pod[];
  namespacePods: k8s.V1Pod[];
  platformPods: k8s.V1Pod[];
  workloads: InfrastructureDesiredWorkload[];
  deployments: k8s.V1Deployment[];
  deploymentStrategy?: EnvironmentDeploymentStrategy | null;
}): InfrastructureCapacitySnapshot {
  const allocatableMemoryMi =
    input.nodes.length > 0
      ? input.nodes.reduce((sum, node) => sum + getNodeAllocatableMemoryMi(node), 0)
      : null;
  const requestedMemoryMi = input.allPods.length > 0 ? sumRequestedMemory(input.allPods) : null;
  const availableMemoryMi =
    allocatableMemoryMi !== null && requestedMemoryMi !== null
      ? Math.max(allocatableMemoryMi - requestedMemoryMi, 0)
      : null;
  const saturationPercent =
    allocatableMemoryMi && requestedMemoryMi !== null
      ? (requestedMemoryMi / allocatableMemoryMi) * 100
      : null;
  const platformRequestedMemoryMi =
    input.platformPods.length > 0 ? sumRequestedMemory(input.platformPods) : null;
  const environmentRequestedMemoryMi =
    input.namespacePods.length > 0 ? sumRequestedMemory(input.namespacePods) : null;
  const estimatedRolloutDeltaMemoryMi = estimateRolloutDeltaMemoryMi(
    input.workloads,
    input.deployments,
    input.deploymentStrategy
  );

  return {
    nodeCount: input.nodes.length,
    allocatableMemoryMi,
    requestedMemoryMi,
    availableMemoryMi,
    saturationPercent,
    saturationLabel: formatPercent(saturationPercent),
    allocatableMemoryLabel: formatMemoryMi(allocatableMemoryMi),
    requestedMemoryLabel: formatMemoryMi(requestedMemoryMi),
    availableMemoryLabel: formatMemoryMi(availableMemoryMi),
    platformRequestedMemoryMi,
    platformRequestedMemoryLabel: formatMemoryMi(platformRequestedMemoryMi),
    environmentRequestedMemoryMi,
    environmentRequestedMemoryLabel: formatMemoryMi(environmentRequestedMemoryMi),
    estimatedRolloutDeltaMemoryMi,
    estimatedRolloutDeltaMemoryLabel: formatMemoryMi(estimatedRolloutDeltaMemoryMi),
  };
}

function buildAbnormalResources(input: {
  now: number;
  namespacePods: k8s.V1Pod[];
  allPods: k8s.V1Pod[];
}): InfrastructureAbnormalResources {
  const namespacePendingPods = input.namespacePods
    .filter((pod) => pod.status?.phase === 'Pending')
    .map((pod) => pod.metadata?.name ?? 'pod');
  const namespaceCrashLoopPods = input.namespacePods
    .filter((pod) =>
      (pod.status?.containerStatuses ?? []).some(
        (status) => status.state?.waiting?.reason === 'CrashLoopBackOff'
      )
    )
    .map((pod) => pod.metadata?.name ?? 'pod');
  const namespaceImagePullPods = input.namespacePods
    .filter((pod) =>
      (pod.status?.containerStatuses ?? []).some((status) =>
        ['ImagePullBackOff', 'ErrImagePull'].includes(status.state?.waiting?.reason ?? '')
      )
    )
    .map((pod) => pod.metadata?.name ?? 'pod');
  const namespaceOOMKilledPods = input.namespacePods
    .filter((pod) =>
      (pod.status?.containerStatuses ?? []).some((status) =>
        ['OOMKilled'].includes(
          status.state?.terminated?.reason ?? status.lastState?.terminated?.reason ?? ''
        )
      )
    )
    .map((pod) => pod.metadata?.name ?? 'pod');
  const clusterTerminatingPods = input.allPods
    .filter((pod) => {
      const deletedAt = safeDate(pod.metadata?.deletionTimestamp);
      return (
        deletedAt !== null && input.now - deletedAt.getTime() >= STUCK_TERMINATING_THRESHOLD_MS
      );
    })
    .map((pod) => `${pod.metadata?.namespace ?? 'default'}/${pod.metadata?.name ?? 'pod'}`);
  const clusterLongPendingPods = input.allPods
    .filter((pod) => {
      if (pod.status?.phase !== 'Pending') {
        return false;
      }

      const createdAt = safeDate(pod.metadata?.creationTimestamp);
      return createdAt !== null && input.now - createdAt.getTime() >= LONG_PENDING_THRESHOLD_MS;
    })
    .map((pod) => `${pod.metadata?.namespace ?? 'default'}/${pod.metadata?.name ?? 'pod'}`);

  return {
    namespacePendingPods: createBucket('Pending Pod', namespacePendingPods),
    namespaceCrashLoopPods: createBucket('CrashLoopBackOff Pod', namespaceCrashLoopPods),
    namespaceImagePullPods: createBucket('镜像拉取异常 Pod', namespaceImagePullPods),
    namespaceOOMKilledPods: createBucket('OOMKilled Pod', namespaceOOMKilledPods),
    clusterTerminatingPods: createBucket('卡住的 Terminating Pod', clusterTerminatingPods),
    clusterLongPendingPods: createBucket('长时间 Pending Pod', clusterLongPendingPods),
  };
}

function pickPrimaryIssue(input: {
  incidents: InfrastructureIncident[];
  abnormalResources: InfrastructureAbnormalResources;
  capacity: InfrastructureCapacitySnapshot;
}): InfrastructurePrimaryIssue | null {
  const orderedCodes: InfrastructureIssueCode[] = [
    'capacity_blocked',
    'image_pull_stalled',
    'probe_failed',
    'rollout_deadline_exceeded',
    'runtime_unhealthy',
    'stuck_terminating_pods',
  ];

  for (const code of orderedCodes) {
    if (input.incidents.some((incident) => incident.issueCode === code)) {
      return buildIssueSnapshot(code, input);
    }
  }

  if (
    input.abnormalResources.clusterTerminatingPods.count > 0 &&
    (input.capacity.saturationPercent ?? 0) >= 90
  ) {
    return buildIssueSnapshot('stuck_terminating_pods', input);
  }

  if (
    input.abnormalResources.namespacePendingPods.count > 0 &&
    (input.capacity.saturationPercent ?? 0) >= 90
  ) {
    return buildIssueSnapshot('capacity_blocked', input);
  }

  if (input.abnormalResources.namespaceImagePullPods.count > 0) {
    return buildIssueSnapshot('image_pull_stalled', input);
  }

  if (
    input.abnormalResources.namespaceCrashLoopPods.count > 0 ||
    input.abnormalResources.namespaceOOMKilledPods.count > 0
  ) {
    return buildIssueSnapshot('runtime_unhealthy', input);
  }

  return null;
}

function buildDiagnosticsSummary(input: {
  primaryIssue: InfrastructurePrimaryIssue | null;
  abnormalResources: InfrastructureAbnormalResources;
  capacity: InfrastructureCapacitySnapshot;
}): { summary: string | null; nextActionLabel: string | null } {
  if (input.primaryIssue) {
    const additions: string[] = [];

    if (input.abnormalResources.clusterTerminatingPods.count > 0) {
      additions.push(
        `${input.abnormalResources.clusterTerminatingPods.count} 个 Terminating Pod 未释放调度位`
      );
    }

    if (
      input.primaryIssue.code !== 'image_pull_stalled' &&
      input.abnormalResources.namespaceImagePullPods.count > 0
    ) {
      additions.push(
        `${input.abnormalResources.namespaceImagePullPods.count} 个 Pod 存在镜像拉取异常`
      );
    }

    if (
      input.primaryIssue.code !== 'runtime_unhealthy' &&
      input.abnormalResources.namespaceCrashLoopPods.count +
        input.abnormalResources.namespaceOOMKilledPods.count >
        0
    ) {
      additions.push('新版本容器存在运行时不健康信号');
    }

    return {
      summary:
        additions.length > 0
          ? `${input.primaryIssue.summary}；同时 ${additions.join('，')}`
          : input.primaryIssue.summary,
      nextActionLabel: input.primaryIssue.nextActionLabel,
    };
  }

  if (
    input.capacity.saturationPercent !== null &&
    input.capacity.saturationPercent >= 95 &&
    input.abnormalResources.clusterTerminatingPods.count > 0
  ) {
    return {
      summary: `当前集群内存请求已达 ${input.capacity.saturationLabel ?? '高位'}，并且存在 ${input.abnormalResources.clusterTerminatingPods.count} 个残留 Terminating Pod`,
      nextActionLabel: '先清理残留资源，再重新推进发布',
    };
  }

  return {
    summary: '当前没有发现明显的基础设施级阻塞，容量、调度和运行时状态基本稳定',
    nextActionLabel: null,
  };
}

function buildRecommendations(input: {
  primaryIssue: InfrastructurePrimaryIssue | null;
  abnormalResources: InfrastructureAbnormalResources;
  capacity: InfrastructureCapacitySnapshot;
}): InfrastructureDiagnosticsSnapshot['recommendations'] {
  const recommendations: InfrastructureDiagnosticsSnapshot['recommendations'] = [];

  if (input.primaryIssue) {
    recommendations.push({
      key: `primary:${input.primaryIssue.code}`,
      label: input.primaryIssue.label,
      summary: input.primaryIssue.nextActionLabel,
    });
  }

  if (input.abnormalResources.clusterTerminatingPods.count > 0) {
    recommendations.push({
      key: 'cleanup:terminating',
      label: '先处理残留资源',
      summary: '长时间 Terminating 的 Pod 会继续占用调度位，应该优先清理。',
    });
  }

  if (input.abnormalResources.clusterLongPendingPods.count > 0) {
    recommendations.push({
      key: 'cleanup:pending',
      label: '排查长期 Pending',
      summary: '持续 Pending 往往不是应用代码问题，而是调度、镜像或容量问题。',
    });
  }

  if ((input.capacity.saturationPercent ?? 0) >= 90) {
    recommendations.push({
      key: 'capacity:budget',
      label: '先看容量预算',
      summary: `集群内存请求已经达到 ${input.capacity.saturationLabel ?? '高位'}，继续放量前先确认资源余量。`,
    });
  }

  return recommendations.slice(0, 4);
}

export async function getInfrastructureDiagnostics(
  input: InfrastructureDiagnosticsInput
): Promise<InfrastructureDiagnosticsSnapshot> {
  const platformNamespace = input.platformNamespace?.trim() || DEFAULT_PLATFORM_NAMESPACE;
  const now = Date.now();
  const [namespacePodsResult, deploymentsResult, eventsResult, nodesResult, allPodsResult] =
    await Promise.allSettled([
      getPods(input.namespace),
      getDeployments(input.namespace),
      getEvents(input.namespace),
      getNodes(),
      getPodsAllNamespaces(),
    ]);

  const namespacePods = namespacePodsResult.status === 'fulfilled' ? namespacePodsResult.value : [];
  const deployments = deploymentsResult.status === 'fulfilled' ? deploymentsResult.value : [];
  const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
  const nodes = nodesResult.status === 'fulfilled' ? nodesResult.value : [];
  const allPods = allPodsResult.status === 'fulfilled' ? allPodsResult.value : [];
  const platformPods =
    allPods.length > 0
      ? allPods.filter((pod) => pod.metadata?.namespace === platformNamespace)
      : input.namespace === platformNamespace
        ? namespacePods
        : [];

  const abnormalResources = buildAbnormalResources({
    now,
    namespacePods,
    allPods,
  });
  const capacity = buildCapacitySnapshot({
    nodes,
    allPods,
    namespacePods,
    platformPods,
    workloads: input.workloads ?? [],
    deployments,
    deploymentStrategy: input.deploymentStrategy,
  });
  const window = computeReleaseWindow(input.releaseWindow);
  const incidents = dedupeIncidents(
    [
      ...events
        .map((event) => describeEvent(event))
        .filter((event): event is EventIssue => event !== null),
      ...describePodIssues(namespacePods),
      ...describeDeploymentIssues(deployments),
    ],
    window
  );
  const primaryIssue = pickPrimaryIssue({
    incidents,
    abnormalResources,
    capacity,
  });
  const summary = buildDiagnosticsSummary({
    primaryIssue,
    abnormalResources,
    capacity,
  });

  return {
    available:
      namespacePodsResult.status === 'fulfilled' ||
      deploymentsResult.status === 'fulfilled' ||
      eventsResult.status === 'fulfilled',
    namespace: input.namespace,
    primaryIssue,
    summary: summary.summary,
    nextActionLabel: summary.nextActionLabel,
    recommendations: buildRecommendations({
      primaryIssue,
      abnormalResources,
      capacity,
    }),
    signalChips: buildSignalChips({
      primaryIssue,
      abnormalResources,
    }),
    incidents,
    capacity,
    abnormalResources,
  };
}
