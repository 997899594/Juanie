import { listArgoRollouts, scaleArgoRolloutIfExists } from '@/lib/argocd';
import { db } from '@/lib/db';
import { isProductionEnvironment } from '@/lib/environments/model';
import { getDeployments, isK8sAvailable, scaleDeploymentIfExists } from '@/lib/k8s';
import { buildProjectScopedK8sName } from '@/lib/k8s/naming';

export type EnvironmentRuntimeState = {
  state: 'running' | 'sleeping' | 'partial' | 'not_deployed' | 'unknown';
  desiredReplicas: number;
  readyReplicas: number;
  workloadCount: number;
  summary: string;
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
};

type EnvironmentRuntimeService = {
  name: string;
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
      name: true,
      replicas: true,
    },
  });
}

export async function getEnvironmentRuntimeState(input: {
  project: EnvironmentRuntimeProject;
  environment: EnvironmentRuntimeRecord;
  services?: EnvironmentRuntimeService[];
}): Promise<EnvironmentRuntimeState> {
  if (!input.environment.namespace) {
    return {
      state: 'unknown',
      desiredReplicas: 0,
      readyReplicas: 0,
      workloadCount: 0,
      summary: '环境命名空间还没有建立',
    };
  }

  if (!isK8sAvailable()) {
    return {
      state: 'unknown',
      desiredReplicas: 0,
      readyReplicas: 0,
      workloadCount: 0,
      summary: '当前无法连接 Kubernetes',
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
    };
  } catch (error) {
    return {
      state: 'unknown',
      desiredReplicas: 0,
      readyReplicas: 0,
      workloadCount: 0,
      summary: error instanceof Error ? error.message : '运行态暂不可用',
    };
  }
}

export async function setEnvironmentRuntimeState(input: {
  project: EnvironmentRuntimeProject;
  environment: EnvironmentRuntimeRecord;
  action: 'sleep' | 'wake';
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

  return getEnvironmentRuntimeState({
    project: input.project,
    environment: input.environment,
    services: serviceList,
  });
}
