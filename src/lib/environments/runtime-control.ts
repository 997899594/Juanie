import { eq } from 'drizzle-orm';
import { listArgoRollouts, scaleArgoRolloutIfExists } from '@/lib/argocd';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { syncEnvironmentWakeRoutes } from '@/lib/domains/wake-routing';
import {
  buildEnvironmentAutoSleepSnapshot,
  type EnvironmentAutoSleepSnapshot,
} from '@/lib/environments/idle-policy';
import { isProductionEnvironment } from '@/lib/environments/model';
import { getDeployments, isK8sAvailable, scaleDeploymentIfExists } from '@/lib/k8s';
import { buildProjectScopedK8sName } from '@/lib/k8s/naming';
import {
  buildStableDeploymentName,
  syncEnvironmentServiceTrafficRoutes,
} from '@/lib/releases/traffic';

export type EnvironmentRuntimeState = {
  state: 'running' | 'sleeping' | 'partial' | 'not_deployed' | 'unknown';
  desiredReplicas: number;
  readyReplicas: number;
  workloadCount: number;
  summary: string;
  autoSleep: EnvironmentAutoSleepSnapshot;
};

type EnvironmentRuntimeProject = {
  id: string;
  slug: string;
};

type EnvironmentRuntimeRecord = {
  id: string;
  name: string;
  namespace: string | null;
  kind?: 'production' | 'persistent' | 'preview' | null;
  isProduction?: boolean | null;
  isPreview?: boolean | null;
  autoSleepEnabled?: boolean | null;
  idleSleepMinutes?: number | null;
  lastRuntimeActivityAt?: Date | string | null;
  lastRuntimeSleptAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

type EnvironmentRuntimeService = {
  id: string;
  name: string;
  type: string;
  isPublic?: boolean | null;
  port?: number | null;
  replicas: number | null;
};

function desiredReplicasForService(service: EnvironmentRuntimeService): number {
  return Math.max(service.replicas ?? 1, 1);
}

function getWorkloadName(projectSlug: string, service: EnvironmentRuntimeService): string {
  return buildProjectScopedK8sName(projectSlug, service.name);
}

async function getProjectServices(projectId: string): Promise<EnvironmentRuntimeService[]> {
  return db.query.services.findMany({
    where: (service, { eq }) => eq(service.projectId, projectId),
    columns: {
      id: true,
      name: true,
      type: true,
      isPublic: true,
      port: true,
      replicas: true,
    },
  });
}

async function waitForEnvironmentRuntimeState(input: {
  project: EnvironmentRuntimeProject;
  environment: EnvironmentRuntimeRecord;
  services: EnvironmentRuntimeService[];
  targetState: EnvironmentRuntimeState['state'];
  timeoutMs: number;
  pollIntervalMs?: number;
}): Promise<EnvironmentRuntimeState> {
  const pollIntervalMs = input.pollIntervalMs ?? 2_000;
  const deadline = Date.now() + input.timeoutMs;
  let runtimeState = await getEnvironmentRuntimeState(input);

  while (runtimeState.state !== input.targetState && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    runtimeState = await getEnvironmentRuntimeState(input);
  }

  return runtimeState;
}

async function syncEnvironmentRuntimeRoutes(input: {
  project: EnvironmentRuntimeProject;
  environment: EnvironmentRuntimeRecord;
  services: EnvironmentRuntimeService[];
  runtimeState: EnvironmentRuntimeState;
}): Promise<void> {
  if (!input.environment.namespace) {
    return;
  }

  if (input.runtimeState.state === 'sleeping' || input.runtimeState.state === 'partial') {
    await syncEnvironmentWakeRoutes({
      environmentId: input.environment.id,
      environmentNamespace: input.environment.namespace,
    });
    return;
  }

  if (input.runtimeState.state !== 'running') {
    return;
  }

  for (const service of input.services) {
    if (service.type !== 'web' || service.isPublic === false) {
      continue;
    }

    await syncEnvironmentServiceTrafficRoutes({
      projectSlug: input.project.slug,
      environmentId: input.environment.id,
      namespace: input.environment.namespace,
      service,
      backends: [
        {
          serviceName: buildStableDeploymentName(input.project.slug, service.name),
          servicePort: service.port ?? 3000,
          weight: 100,
        },
      ],
    });
  }
}

export async function getEnvironmentRuntimeState(input: {
  project: EnvironmentRuntimeProject;
  environment: EnvironmentRuntimeRecord;
  services?: EnvironmentRuntimeService[];
}): Promise<EnvironmentRuntimeState> {
  const autoSleep = buildEnvironmentAutoSleepSnapshot(input.environment);

  if (!input.environment.namespace) {
    return {
      state: 'unknown',
      desiredReplicas: 0,
      readyReplicas: 0,
      workloadCount: 0,
      summary: '环境命名空间还没有建立',
      autoSleep,
    };
  }

  if (!isK8sAvailable()) {
    return {
      state: 'unknown',
      desiredReplicas: 0,
      readyReplicas: 0,
      workloadCount: 0,
      summary: '当前无法连接 Kubernetes',
      autoSleep,
    };
  }

  const serviceList = input.services ?? (await getProjectServices(input.project.id));
  const expectedWorkloadNames = new Set(
    serviceList.map((service) => getWorkloadName(input.project.slug, service))
  );

  try {
    const [deploymentList, rolloutList] = await Promise.all([
      getDeployments(input.environment.namespace),
      listArgoRollouts(input.environment.namespace),
    ]);
    const workloadSnapshots = [
      ...deploymentList
        .filter((deployment) => expectedWorkloadNames.has(deployment.metadata?.name ?? ''))
        .map((deployment) => ({
          desiredReplicas: deployment.spec?.replicas ?? 0,
          readyReplicas: deployment.status?.readyReplicas ?? 0,
        })),
      ...rolloutList
        .filter((rollout) => expectedWorkloadNames.has(rollout.metadata?.name ?? ''))
        .map((rollout) => ({
          desiredReplicas: rollout.spec?.replicas ?? 0,
          readyReplicas: rollout.status?.readyReplicas ?? rollout.status?.availableReplicas ?? 0,
        })),
    ];

    if (workloadSnapshots.length === 0) {
      return {
        state: 'not_deployed',
        desiredReplicas: 0,
        readyReplicas: 0,
        workloadCount: 0,
        summary: '当前环境还没有可休眠的应用工作负载',
        autoSleep,
      };
    }

    const desiredReplicas = workloadSnapshots.reduce(
      (sum, workload) => sum + workload.desiredReplicas,
      0
    );
    const readyReplicas = workloadSnapshots.reduce(
      (sum, workload) => sum + workload.readyReplicas,
      0
    );
    const state =
      desiredReplicas === 0 ? 'sleeping' : readyReplicas >= desiredReplicas ? 'running' : 'partial';

    return {
      state,
      desiredReplicas,
      readyReplicas,
      workloadCount: workloadSnapshots.length,
      summary:
        state === 'sleeping'
          ? '应用工作负载已休眠，数据库和配置仍保留'
          : `${readyReplicas}/${desiredReplicas} 个应用副本可用`,
      autoSleep,
    };
  } catch (error) {
    return {
      state: 'unknown',
      desiredReplicas: 0,
      readyReplicas: 0,
      workloadCount: 0,
      summary: error instanceof Error ? error.message : '运行态暂不可用',
      autoSleep,
    };
  }
}

export async function markEnvironmentRuntimeActivity(environmentId: string): Promise<void> {
  await db
    .update(environments)
    .set({
      lastRuntimeActivityAt: new Date(),
      lastRuntimeSleptAt: null,
      updatedAt: new Date(),
    })
    .where(eq(environments.id, environmentId));
}

export async function setEnvironmentRuntimeState(input: {
  project: EnvironmentRuntimeProject;
  environment: EnvironmentRuntimeRecord;
  action: 'sleep' | 'wake';
  waitForReadyMs?: number;
}): Promise<EnvironmentRuntimeState> {
  if (isProductionEnvironment(input.environment)) {
    throw new Error('生产环境不允许休眠');
  }

  if (!input.environment.namespace) {
    throw new Error('环境命名空间还没有建立');
  }

  if (!isK8sAvailable()) {
    throw new Error('当前无法连接 Kubernetes');
  }

  const serviceList = await getProjectServices(input.project.id);
  const scaleResults = await Promise.all(
    serviceList.map(async (service) => {
      const name = getWorkloadName(input.project.slug, service);
      const replicas = input.action === 'sleep' ? 0 : desiredReplicasForService(service);
      const [deploymentScaled, rolloutScaled] = await Promise.all([
        scaleDeploymentIfExists({
          namespace: input.environment.namespace as string,
          name,
          replicas,
        }),
        scaleArgoRolloutIfExists({
          namespace: input.environment.namespace as string,
          name,
          replicas,
        }),
      ]);

      return deploymentScaled || rolloutScaled;
    })
  );

  if (!scaleResults.some(Boolean)) {
    throw new Error('当前环境还没有可控制的应用工作负载');
  }

  const now = new Date();
  const updatedEnvironment = {
    ...input.environment,
    lastRuntimeActivityAt: input.action === 'wake' ? now : input.environment.lastRuntimeActivityAt,
    lastRuntimeSleptAt: input.action === 'sleep' ? now : null,
    updatedAt: now,
  };

  await db
    .update(environments)
    .set({
      lastRuntimeActivityAt: input.action === 'wake' ? now : undefined,
      lastRuntimeSleptAt: input.action === 'sleep' ? now : null,
      updatedAt: now,
    })
    .where(eq(environments.id, input.environment.id));

  const runtimeState =
    input.action === 'wake' && (input.waitForReadyMs ?? 30_000) > 0
      ? await waitForEnvironmentRuntimeState({
          project: input.project,
          environment: updatedEnvironment,
          services: serviceList,
          targetState: 'running',
          timeoutMs: input.waitForReadyMs ?? 30_000,
        })
      : await getEnvironmentRuntimeState({
          project: input.project,
          environment: updatedEnvironment,
          services: serviceList,
        });

  await syncEnvironmentRuntimeRoutes({
    project: input.project,
    environment: updatedEnvironment,
    services: serviceList,
    runtimeState,
  });

  return runtimeState;
}
